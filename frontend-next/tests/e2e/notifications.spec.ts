import { expect, test, type APIRequestContext } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

async function backendJson<T>(
  request: APIRequestContext,
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "PUT";
    token?: string;
    data?: unknown;
    multipart?: Record<string, string | { name: string; mimeType: string; buffer: Buffer }>;
  } = {},
) {
  const response = await request.fetch(`${backendBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: options.token ? { Authorization: `Bearer ${options.token}` } : undefined,
    data: options.data,
    multipart: options.multipart,
  });

  expect(response.ok(), `${options.method ?? "GET"} ${path} -> ${response.status()}: ${await response.text()}`).toBeTruthy();
  return (await response.json()) as T;
}

test("Internal Notification Center E2E Flow", async ({ browser, request }) => {
  test.setTimeout(180000);

  const stamp = Date.now();
  const sellerEmail = `notif-seller-${stamp}@example.com`;
  const sellerPassword = "password123";
  const customerEmail = `notif-customer-${stamp}@example.com`;
  const customerPassword = "password123";
  const buyerPhone = `+7994${String(stamp).slice(-7)}`;
  const productNmId = 8200000 + (stamp % 100000);

  // 1. Register and onboarding seller
  const sellerRegister = await backendJson<{ userId: string }>(request, "/api/auth/register", {
    method: "POST",
    data: {
      email: sellerEmail,
      password: sellerPassword,
      fullName: "Notification Seller",
      role: "SELLER",
    },
  });
  const sellerLogin = await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
    method: "POST",
    data: { email: sellerEmail, password: sellerPassword },
  });

  await backendJson(request, "/api/seller/onboarding/profile", {
    method: "PUT",
    token: sellerLogin.accessToken,
    data: {
      legalType: "IP",
      legalName: "Notif Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow",
      contactName: "Notif Seller",
      contactPhone: "+79990000074",
      contactEmail: sellerEmail,
    },
  });

  const sellerDocument = await backendJson<{ id: string }>(request, "/api/seller/onboarding/documents", {
    method: "POST",
    token: sellerLogin.accessToken,
    multipart: {
      documentType: "INN",
      file: {
        name: "notif-proof.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n"),
      },
    },
  });

  // Approve seller
  const adminLogin = await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
    method: "POST",
    data: {
      email: "demo-admin@trawberry.local",
      password: "DemoAdmin123!",
    },
  });
  await backendJson(request, `/api/admin/sellers/${sellerRegister.userId}/documents/${sellerDocument.id}/approve`, {
    method: "POST",
    token: adminLogin.accessToken,
  });
  await backendJson(request, `/api/admin/sellers/${sellerRegister.userId}/approve`, {
    method: "POST",
    token: adminLogin.accessToken,
  });

  // Create shop
  const shop = await backendJson<{ id: string }>(request, "/api/shops", {
    method: "POST",
    token: sellerLogin.accessToken,
    data: {
      name: `Notif Shop ${stamp}`,
      slug: `notif-shop-${stamp}`,
    },
  });

  // Configure payments & delivery
  await backendJson(request, `/api/shops/${shop.id}/payment-settings`, {
    method: "PATCH",
    token: sellerLogin.accessToken,
    data: {
      paymentMode: "STATIC_QR",
      status: "READY",
      bankName: "T-Bank",
      recipientName: "Notif Seller",
      recipientPhone: "+79990000074",
      recipientAccount: "40817810000000000774",
      sbpPhone: "+79990000074",
      paymentInstruction: "Pay by QR.",
      allowPrepaidQr: true,
      allowPayOnDeliverySellerQr: true,
      allowDepositPayment: false,
    },
  });
  await backendJson(request, `/api/shops/${shop.id}/delivery/settings`, {
    method: "PATCH",
    token: sellerLogin.accessToken,
    data: {
      pickupAddress: "Tverskaya Street 7, Moscow",
      pickupCity: "Moscow",
      pickupPostalCode: "125009",
      pickupContactPhone: "+79990000074",
      pickupContactName: "Notif Seller",
      enabledCarriers: ["YANDEX"],
      defaultCarrier: "YANDEX",
      sameCityPreferredCarrier: "YANDEX",
      interCityPreferredCarrier: "YANDEX",
      fallbackCarrier: "YANDEX",
      defaultWeightGram: 500,
      defaultLengthCm: 30,
      defaultWidthCm: 20,
      defaultHeightCm: 10,
    },
  });

  // Create product
  const product = await backendJson<{ id: string }>(request, `/api/shops/${shop.id}/products`, {
    method: "POST",
    token: sellerLogin.accessToken,
    data: {
      wbNmId: productNmId,
      wbTitle: `Notif Product ${stamp}`,
      localTitle: `Notif Product ${stamp}`,
      localDescription: "Notification testing product",
      categoryName: "Notif Category",
      visibility: "ACTIVE",
      variants: [
        {
          chrtId: productNmId + 1,
          techSize: "Default",
          basePrice: 150,
          stockQuantity: 10,
          trackInventory: true,
          isActive: true,
        },
      ],
      images: [
        {
          wbUrl: "https://example.com/notif.jpg",
          localUrl: "https://example.com/notif.jpg",
          isMain: true,
          sortOrder: 0,
        },
      ],
    },
  });
  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/publish`, {
    method: "POST",
    token: sellerLogin.accessToken,
  });

  // Register Customer
  await backendJson(request, "/api/auth/register", {
    method: "POST",
    data: {
      email: customerEmail,
      password: customerPassword,
      fullName: "Notification Customer",
      role: "CUSTOMER",
      phone: buyerPhone,
    },
  });

  // 2. Open Customer browser and login
  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  await customerPage.goto("/customer/login");
  await customerPage.getByTestId("customer-login-email").fill(customerEmail);
  await customerPage.getByTestId("customer-login-password").fill(customerPassword);
  await customerPage.getByTestId("customer-login-submit").click();
  await customerPage.waitForURL("**/customer/orders");

  // Buy the product (Checkout)
  await customerPage.goto(`/products/${product.id}`);
  await customerPage.getByTestId("continue-to-checkout").click();
  await customerPage.waitForURL(/\/checkout/);
  await customerPage.getByTestId("checkout-address").fill("Moscow, Sync Street 5");
  await customerPage.getByTestId("checkout-submit").click();
  await expect(customerPage.getByTestId("checkout-confirmation")).toBeVisible();
  const confirmationText = await customerPage.getByTestId("checkout-confirmation").innerText();
  const orderId = confirmationText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0] ?? "";
  expect(orderId).toBeTruthy();

  // 3. Open Seller browser and verify ORDER_NEW notification
  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  sellerPage.on("console", (msg) => console.log(`[SELLER BROWSER] ${msg.type()}: ${msg.text()}`));
  await sellerPage.goto("/login");
  await sellerPage.getByTestId("login-email").fill(sellerEmail);
  await sellerPage.getByTestId("login-password").fill(sellerPassword);
  await sellerPage.getByTestId("login-submit").click();
  await sellerPage.waitForURL("**/seller/dashboard");

  // Check unread badge and toggle bell
  const bell = sellerPage.getByTestId("notification-bell");
  await expect(bell).toBeVisible();
  const badge = sellerPage.getByTestId("notification-unread-badge");
  await expect(badge).toBeVisible();
  await expect(badge).toContainText("1");

  await bell.click();
  const dropdown = sellerPage.getByTestId("notification-dropdown");
  await expect(dropdown).toBeVisible();
  await expect(dropdown).toContainText("Có đơn hàng mới");

  // Go to seller notifications page
  await sellerPage.goto("/seller/notifications");
  await expect(sellerPage.getByTestId("notifications-page")).toBeVisible();
  await expect(sellerPage.getByRole("heading", { name: "Có đơn hàng mới" })).toBeVisible();

  // 4. Customer uploads payment proof -> Triggering PAYMENT_CONFIRMATION_REQUIRED
  await backendJson(request, `/api/public/orders/${orderId}/payment-proof`, {
    method: "POST",
    multipart: {
      phone: buyerPhone,
      buyerNote: "Direct QR payment proof upload.",
      file: {
        name: "proof.png",
        mimeType: "image/png",
        buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=", "base64"),
      },
    },
  });

  // Seller checks count (should dedupe/increment based on new proofs)
  await sellerPage.goto("/seller/notifications");
  await expect(sellerPage.getByRole("heading", { name: "Có minh chứng thanh toán mới" })).toBeVisible();

  // 5. Seller confirms payment -> Triggering DELIVERY_STATUS_CHANGED for customer
  await backendJson(request, `/api/shops/${shop.id}/payments/${orderId}/confirm`, {
    method: "POST",
    token: sellerLogin.accessToken,
    data: { note: "Seller confirmed payment proof." },
  });

  // Customer checks notifications
  await customerPage.goto("/customer/notifications");
  await expect(customerPage.getByRole("heading", { name: "Thanh toán đã được xác nhận" })).toBeVisible();

  // Mark all read on Customer side
  const markAllReadBtn = customerPage.getByTestId("mark-all-read-btn");
  await expect(markAllReadBtn).toBeVisible();
  await markAllReadBtn.click();
  await expect(customerPage.getByTestId("notification-unread-badge")).toHaveCount(0);

  // Close contexts
  await customerContext.close();
  await sellerContext.close();
});
