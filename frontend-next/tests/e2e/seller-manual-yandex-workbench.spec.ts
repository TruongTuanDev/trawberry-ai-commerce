import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";

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
    data: { email, password, fullName: "Yandex Workbench Seller", role: "SELLER" },
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
      legalName: "Yandex Workbench Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow",
      contactName: "Yandex Workbench Seller",
      contactPhone: "+79990000008",
      contactEmail: email,
    },
  });
  const document = await backendJson<{ id: string }>(request, "/api/seller/onboarding/documents", {
    method: "POST",
    token: sellerLogin.accessToken,
    multipart: {
      documentType: "INN",
      file: { name: "yandex-workbench.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") },
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
    sellerToken: (await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
      method: "POST",
      data: { email, password },
    })).accessToken,
    adminToken: adminLogin.accessToken,
  };
}

async function createPaidOrder(request: APIRequestContext, sellerToken: string, stamp: number, phone: string) {
  const shop = await backendJson<{ id: string }>(request, "/api/shops", {
    method: "POST",
    token: sellerToken,
    data: { name: `Yandex Workbench Shop ${stamp}`, slug: `yandex-workbench-shop-${stamp}`, paymentInstructions: "Manual transfer." },
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
      wbNmId: 7600000 + (stamp % 100000),
      wbTitle: `Yandex Workbench Product ${stamp}`,
      localTitle: `Yandex Workbench Product ${stamp}`,
      localDescription: "Manual Yandex workbench E2E product",
      categoryName: "Workbench Category",
      visibility: "ACTIVE",
      variants: [{ chrtId: 8600000 + (stamp % 100000), basePrice: 199, discountPrice: 199, stockQuantity: 5 }],
      images: [{ wbUrl: "https://example.com/yandex-workbench.jpg", localUrl: "https://example.com/yandex-workbench.jpg", isMain: true, sortOrder: 0 }],
    },
  });
  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/publish`, {
    method: "POST",
    token: sellerToken,
    data: {},
  });
  const checkout = await backendJson<{ orderId: string; trackingPath: string }>(request, "/api/checkout/orders", {
    method: "POST",
    data: {
      shopId: shop.id,
      items: [{ productId: product.id, quantity: 1 }],
      customer: {
        fullName: "Yandex Workbench Customer",
        phone,
        email: `yandex-workbench-customer-${stamp}@example.com`,
        address: "Lenina 10, Moscow",
        latitude: 55.751244,
        longitude: 37.618423,
        note: `Manual Yandex workbench ${stamp}`,
      },
      paymentMethod: "PREPAID_SELLER_QR",
    },
  });
  await backendJson<{ paymentStatus: string; status: string }>(request, `/api/shops/${shop.id}/payments/${checkout.orderId}/mark-paid`, {
    method: "POST",
    token: sellerToken,
    data: { note: "Paid for manual Yandex workbench E2E." },
  });
  return { shop, checkout };
}

async function loginSeller(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/seller/dashboard");
}

async function loginAdmin(browser: Browser) {
  const adminPage = await browser.newPage();
  await adminPage.goto("/admin-login");
  await adminPage.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
  await adminPage.getByTestId("admin-login-password").fill("DemoAdmin123!");
  await adminPage.getByTestId("admin-login-submit").click();
  await adminPage.waitForURL("**/admin/dashboard");
  return adminPage;
}

test("seller manual yandex workbench and admin supervision work end-to-end", async ({ page, request, browser }) => {
  test.setTimeout(120000);
  const stamp = Date.now();
  const email = `yandex-workbench-${stamp}@example.com`;
  const password = "password123";
  const phone = `+7994${String(stamp).slice(-7)}`;
  const { sellerToken } = await createApprovedSeller(request, email, password);
  const { checkout } = await createPaidOrder(request, sellerToken, stamp, phone);

  await loginSeller(page, email, password);
  await page.goto(`/seller/orders/${checkout.orderId}`);
  await expect(page.getByText("Create Yandex manually")).toBeVisible();
  await expect(page.getByTestId("seller-order-status")).toContainText("READY_TO_CREATE_YANDEX");

  const adminPage = await loginAdmin(browser);
  await adminPage.goto("/admin/deliveries?status=READY_TO_CREATE_YANDEX");
  await expect(adminPage.getByTestId("admin-deliveries-page")).toBeVisible();
  await adminPage.getByTestId("admin-delivery-search").fill(checkout.orderCode);
  await adminPage.getByRole("button", { name: "Refresh" }).click();
  await expect(adminPage.getByTestId("admin-delivery-row").filter({ hasText: checkout.orderCode })).toBeVisible();

  await page.getByTestId("manual-yandex-order-id").fill(`YANDEX-${stamp}`);
  await page.getByTestId("manual-yandex-claim-id").fill(`claim-${stamp}`);
  await page.getByTestId("manual-delivery-tracking-number").fill(`TRACK-${stamp}`);
  await page.getByTestId("manual-delivery-tracking-url").fill(`https://track.example/yandex/${stamp}`);
  await page.getByTestId("manual-delivery-courier-name").fill("Courier Ivan");
  await page.getByTestId("manual-delivery-courier-phone").fill("+79991112233");
  await page.getByTestId("manual-delivery-price").fill("450");
  await page.getByTestId("manual-delivery-estimated-at").fill("2024-01-01T10:00");
  await page.getByTestId("manual-delivery-note").fill("Created manually in Yandex dashboard.");
  await page.getByTestId("manual-delivery-save").click();
  await expect(page.getByTestId("delivery-action-message")).toContainText("saved");
  await expect(page.getByTestId("seller-delivery-status")).toHaveText("YANDEX_MANUAL_CREATED");

  await page.getByTestId("manual-delivery-mark-courier-assigned").click();
  await expect(page.getByTestId("seller-delivery-status")).toHaveText("COURIER_ASSIGNED");
  await page.getByTestId("manual-delivery-mark-picked-up").click();
  await expect(page.getByTestId("seller-delivery-status")).toHaveText("PICKED_UP");
  await page.getByTestId("manual-delivery-mark-in-transit").click();
  await expect(page.getByTestId("seller-delivery-status")).toHaveText("ON_THE_WAY");

  await adminPage.goto("/admin/deliveries?status=OVERDUE");
  await adminPage.getByTestId("admin-delivery-search").fill(checkout.orderCode);
  await adminPage.getByRole("button", { name: "Refresh" }).click();
  await expect(adminPage.getByTestId("admin-delivery-row").filter({ hasText: checkout.orderCode })).toBeVisible();
  await adminPage.getByTestId("admin-delivery-row").filter({ hasText: checkout.orderCode }).click();
  await expect(adminPage.getByTestId("admin-delivery-detail-status")).toHaveText("ON_THE_WAY");
  await adminPage.getByTestId("admin-delivery-mark-delivered").click();
  await expect(adminPage.getByTestId("admin-delivery-message")).toHaveText("Delivery marked delivered.");

  await page.goto(`${checkout.trackingPath}?phone=${encodeURIComponent(phone)}`);
  await expect(page.getByTestId("tracked-delivery-provider")).toHaveText("YANDEX");
  await expect(page.getByTestId("tracked-delivery-status")).toHaveText("DELIVERED");
  await expect(page.getByText("Timeline")).toBeVisible();
  await page.goto(`/seller/orders/${checkout.orderId}`);
  await expect(page.getByTestId("seller-delivery-status")).toHaveText("DELIVERED");
  await adminPage.close();
});
