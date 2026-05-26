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
    data: { email, password, fullName: "Admin Fulfillment Seller", role: "SELLER" },
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
      legalName: "Admin Fulfillment Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow",
      contactName: "Admin Fulfillment Seller",
      contactPhone: "+79990000028",
      contactEmail: email,
    },
  });
  const document = await backendJson<{ id: string }>(request, "/api/seller/onboarding/documents", {
    method: "POST",
    token: sellerLogin.accessToken,
    multipart: {
      documentType: "INN",
      file: { name: "admin-fulfillment.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") },
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
  };
}

async function createShopProduct(request: APIRequestContext, sellerToken: string, stamp: number) {
  const shop = await backendJson<{ id: string; name: string }>(request, "/api/shops", {
    method: "POST",
    token: sellerToken,
    data: { name: `Admin Fulfillment Shop ${stamp}`, slug: `admin-fulfillment-shop-${stamp}`, paymentInstructions: "Pay seller directly." },
  });
  await backendJson(request, `/api/shops/${shop.id}/payment-settings`, {
    method: "PATCH",
    token: sellerToken,
    data: {
      paymentMode: "STATIC_QR",
      status: "READY",
      bankName: "T-Bank",
      recipientName: "Admin Fulfillment Seller",
      recipientPhone: "+79990000028",
      recipientAccount: "40817810000000000128",
      sbpPhone: "+79990000028",
      paymentInstruction: "Pay the seller directly by QR.",
      allowPrepaidQr: true,
      allowPayOnDeliverySellerQr: true,
      allowDepositPayment: false,
    },
  });
  const product = await backendJson<{ id: string }>(request, `/api/shops/${shop.id}/products`, {
    method: "POST",
    token: sellerToken,
    data: {
      wbNmId: 8800000 + (stamp % 100000),
      wbTitle: `Admin Fulfillment Product ${stamp}`,
      localTitle: `Admin Fulfillment Product ${stamp}`,
      localDescription: "Admin fulfillment flow product",
      categoryName: "Admin Fulfillment Category",
      visibility: "ACTIVE",
      variants: [{ chrtId: 9800000 + (stamp % 100000), basePrice: 1000, discountPrice: 1000, stockQuantity: 5 }],
      images: [{ wbUrl: "https://example.com/admin-fulfillment.jpg", localUrl: "https://example.com/admin-fulfillment.jpg", isMain: true, sortOrder: 0 }],
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

test("admin fulfillment page is supervision-only while seller keeps status ownership", async ({ request, browser }) => {
  test.setTimeout(300000);

  const stamp = Date.now();
  const sellerEmail = `admin-fulfillment-seller-${stamp}@example.com`;
  const password = "password123";
  const customerPhone = `+7993${String(stamp).slice(-7)}`;
  const { sellerToken } = await createApprovedSeller(request, sellerEmail, password);
  const { shop, product } = await createShopProduct(request, sellerToken, stamp);

  const checkout = await backendJson<{ orderId: string; orderCode: string }>(request, "/api/checkout/orders", {
    method: "POST",
    data: {
      shopId: shop.id,
      items: [{ productId: product.id, quantity: 1 }],
      customer: {
        fullName: "Admin Fulfillment Customer",
        phone: customerPhone,
        email: `admin-fulfillment-customer-${stamp}@example.com`,
        address: "Tverskaya 18, Moscow",
      },
      paymentMethod: "PREPAID_SELLER_QR",
    },
  });

  await backendJson(request, `/api/shops/${shop.id}/payments/${checkout.orderId}/confirm`, {
    method: "POST",
    token: sellerToken,
    data: { note: "Paid for admin fulfillment supervision flow." },
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

  const adminPage = await loginAdmin(browser);
  await adminPage.goto("/admin/deliveries?bucket=NEW");
  await expect(adminPage.getByTestId("admin-supervision-readonly-note")).toContainText("Seller owns fulfillment status transitions");
  await adminPage.getByTestId("admin-fulfillment-tab-NEW").click();
  await adminPage.getByTestId("admin-delivery-search").fill(checkout.orderCode);
  await adminPage.getByRole("button", { name: "Refresh" }).click();
  const newRow = adminPage.getByTestId("admin-delivery-row").filter({ hasText: checkout.orderCode });
  await expect(newRow).toBeVisible();
  await newRow.click();
  await expect(adminPage.getByTestId("admin-delivery-detail-status")).toContainText("New");
  await expect(adminPage.getByTestId("admin-delivery-detail")).toContainText(shop.name);
  await expect(adminPage.getByTestId("admin-delivery-detail")).toContainText("Paid");
  await expect(adminPage.getByTestId("admin-delivery-detail")).toContainText("Missing");
  await expect(adminPage.getByRole("button", { name: "Remind seller" })).toBeVisible();
  await expect(adminPage.getByTestId("admin-delivery-mark-in-transit")).toHaveCount(0);
  await expect(adminPage.getByTestId("admin-delivery-detail").getByRole("button", { name: /archive/i })).toHaveCount(0);

  const shipment = await backendJson<{ id: string }>(request, `/api/shops/${shop.id}/orders/${checkout.orderId}/delivery/manual`, {
    method: "POST",
    token: sellerToken,
    data: {
      provider: "YANDEX",
      manualYandexOrderId: `YANDEX-${stamp}`,
      trackingUrl: `https://track.example/admin-fulfillment/${stamp}`,
      yandexTrackingLink: `https://track.example/admin-fulfillment/${stamp}`,
      note: "Created from seller flow.",
    },
  });

  await adminPage.getByTestId("admin-fulfillment-tab-ASSEMBLING").click();
  await adminPage.getByTestId("admin-delivery-search").fill(checkout.orderCode);
  await adminPage.getByRole("button", { name: "Refresh" }).click();
  const assemblingRow = adminPage.getByTestId("admin-delivery-row").filter({ hasText: checkout.orderCode });
  await expect(assemblingRow).toBeVisible();
  await assemblingRow.click();
  await expect(adminPage.getByTestId("admin-delivery-detail")).toContainText(`YANDEX-${stamp}`);
  await adminPage.getByTestId("admin-remind-seller-yandex").click();
  await expect(adminPage.getByTestId("admin-delivery-message")).toContainText(/Seller reminder sent|A reminder already exists/i);

  await backendJson(request, `/api/shops/${shop.id}/orders/${checkout.orderId}/delivery/shipments/${shipment.id}/mark-in-transit`, {
    method: "POST",
    token: sellerToken,
    data: { note: "Seller handed off to delivery." },
  });

  await adminPage.getByTestId("admin-fulfillment-tab-IN_TRANSIT").click();
  await adminPage.getByTestId("admin-delivery-search").fill(checkout.orderCode);
  await adminPage.getByRole("button", { name: "Refresh" }).click();
  const transitRow = adminPage.getByTestId("admin-delivery-row").filter({ hasText: checkout.orderCode });
  await expect(transitRow).toBeVisible();
  await transitRow.click();
  await expect(adminPage.getByRole("button", { name: "Remind seller" })).toBeVisible();
  await expect(adminPage.getByTestId("admin-delivery-mark-in-transit")).toHaveCount(0);
  await expect(adminPage.getByTestId("admin-delivery-detail").getByRole("button", { name: /archive/i })).toHaveCount(0);

  await backendJson(request, `/api/shops/${shop.id}/orders/${checkout.orderId}/delivery/shipments/${shipment.id}/mark-delivered`, {
    method: "POST",
    token: sellerToken,
    data: { note: "Seller completed delivery." },
  });

  await adminPage.getByTestId("admin-fulfillment-tab-COMPLETED").click();
  await adminPage.getByTestId("admin-delivery-search").fill(checkout.orderCode);
  await adminPage.getByRole("button", { name: "Refresh" }).click();
  const completedRow = adminPage.getByTestId("admin-delivery-row").filter({ hasText: checkout.orderCode });
  await expect(completedRow).toBeVisible();
  await completedRow.click();
  await expect(adminPage.getByRole("button", { name: "Remind seller" })).toHaveCount(0);
  await expect(adminPage.getByTestId("admin-delivery-detail").getByRole("button", { name: /archive/i })).toHaveCount(0);

});
