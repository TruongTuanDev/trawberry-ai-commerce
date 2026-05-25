import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

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

async function loginAdminWithRetry(page: Page) {
  await page.goto("/admin-login");
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
    await page.getByTestId("admin-login-password").fill("DemoAdmin123!");
    await page.getByTestId("admin-login-submit").click();
    try {
      await page.waitForURL("**/admin/dashboard", { timeout: 10000 });
      return;
    } catch {
      if (attempt === 5) {
        throw new Error("Admin login stayed blocked by rate limiting.");
      }
      await page.waitForTimeout(1500 * (attempt + 1));
      await page.goto("/admin-login");
    }
  }
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

  const shop = await backendJson<{ id: string }>(request, "/api/shops", {
    method: "POST",
    token: sellerLogin.accessToken,
    data: {
      name: `Notif Shop ${stamp}`,
      slug: `notif-shop-${stamp}`,
    },
  });

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

  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  await customerPage.goto("/customer/login");
  await customerPage.getByTestId("customer-login-email").fill(customerEmail);
  await customerPage.getByTestId("customer-login-password").fill(customerPassword);
  await customerPage.getByTestId("customer-login-submit").click();
  await customerPage.waitForURL("**/customer/orders");

  await customerPage.goto("/customer/account/addresses");
  await customerPage.getByTestId("customer-address-fullName").fill("Notification Customer");
  await customerPage.getByTestId("customer-address-phone").fill(buyerPhone);
  await customerPage.getByTestId("customer-address-city").fill("Moscow");
  await customerPage.getByTestId("customer-address-street").fill("Sync Street");
  await customerPage.getByTestId("customer-address-building").fill("5");
  await customerPage.getByTestId("customer-address-entrance").fill("1");
  await customerPage.getByTestId("customer-address-floor").fill("2");
  await customerPage.getByTestId("customer-address-apartment").fill("3");
  await customerPage.getByTestId("customer-address-latitude").fill("55.7558");
  await customerPage.getByTestId("customer-address-longitude").fill("37.6173");
  await customerPage.getByTestId("customer-address-save").click();
  await expect(customerPage.getByTestId("customer-address-card")).toHaveCount(1);

  await customerPage.goto(`/products/${product.id}`);
  await customerPage.getByTestId("continue-to-checkout").click();
  await customerPage.waitForURL(/\/checkout/);
  await customerPage.getByTestId("checkout-submit").click();
  await expect(customerPage.getByTestId("checkout-confirmation")).toBeVisible();
  const confirmationText = await customerPage.getByTestId("checkout-confirmation").innerText();
  const orderId = confirmationText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0] ?? "";
  expect(orderId).toBeTruthy();

  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await sellerPage.goto("/login");
  await sellerPage.getByTestId("login-email").fill(sellerEmail);
  await sellerPage.getByTestId("login-password").fill(sellerPassword);
  await sellerPage.getByTestId("login-submit").click();
  await sellerPage.waitForURL("**/seller/dashboard");

  const bell = sellerPage.getByTestId("notification-bell");
  await expect(bell).toBeVisible();
  await expect(sellerPage.getByTestId("notification-unread-badge")).toBeVisible();

  await bell.click();
  const dropdown = sellerPage.getByTestId("notification-dropdown");
  await expect(dropdown).toBeVisible();

  await sellerPage.goto("/seller/notifications");
  await expect(sellerPage.getByTestId("notifications-page")).toBeVisible();
  await expect(sellerPage.getByTestId("notification-item").first()).toBeVisible();

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

  await sellerPage.goto("/seller/notifications");
  await expect(sellerPage.getByTestId("notification-item").first()).toBeVisible();

  await backendJson(request, `/api/shops/${shop.id}/payments/${orderId}/confirm`, {
    method: "POST",
    token: sellerLogin.accessToken,
    data: { note: "Seller confirmed payment proof." },
  });

  await customerPage.goto("/customer/notifications");
  await expect(customerPage.getByTestId("notifications-page")).toBeVisible();
  const notifItem = customerPage.getByTestId("notification-item").first();
  await expect(notifItem).toBeVisible();
  const actionBtn = notifItem.getByTestId("notification-action-btn");
  await expect(actionBtn).toBeVisible();
  await actionBtn.click();
  await customerPage.waitForURL(/\/orders\//);

  await customerContext.close().catch(() => undefined);
  await sellerContext.close().catch(() => undefined);
});

test("Notification Center Role Layouts and Empty States", async ({ browser }) => {
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await loginAdminWithRetry(adminPage);
  await adminPage.goto("/admin/notifications");
  await expect(adminPage.getByTestId("notifications-page")).toBeVisible();
  await expect(adminPage.getByTestId("admin-shell")).toHaveCount(1);
  await expect(adminPage.getByRole("heading", { name: /Operations center|Операционный центр|Trung tâm vận hành/ })).toBeVisible();
  await adminPage.getByTestId("category-tab-FINANCE").click();
  await expect(adminPage.getByTestId("empty-state-title")).toHaveText(/No admin actions pending|Нет задач для admin|Chưa có việc nào cần admin xử lý/);
  await expect(adminPage.getByTestId("empty-state-description")).toHaveText(/Notifications will appear here when there are overdue orders|Уведомления появятся здесь, когда будут просроченные заказы|Thông báo sẽ xuất hiện khi có đơn quá hạn/);

  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await sellerPage.goto("/login");
  await sellerPage.getByTestId("login-email").fill("demo-seller@trawberry.local");
  await sellerPage.getByTestId("login-password").fill("DemoSeller123!");
  await sellerPage.getByTestId("login-submit").click();
  await sellerPage.waitForURL("**/seller/dashboard");
  await sellerPage.goto("/seller/notifications");
  await expect(sellerPage.getByTestId("seller-shell")).toHaveCount(1);
  await expect(sellerPage.getByRole("heading", { name: /Action center|Задачи к обработке|Việc cần xử lý/, exact: true })).toBeVisible();
  await sellerPage.getByTestId("category-tab-FINANCE").click();
  await expect(sellerPage.getByTestId("empty-state-title")).toHaveText(/No seller actions pending|Нет задач для продавца|Bạn chưa có việc cần xử lý/);
  await expect(sellerPage.getByTestId("empty-state-description")).toHaveText(/When there are new orders|Когда появятся новые заказы|Khi có đơn mới/);

  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  await customerPage.goto("/customer/login");
  await customerPage.getByTestId("customer-login-email").fill("demo-customer@trawberry.local");
  await customerPage.getByTestId("customer-login-password").fill("DemoCustomer123!");
  await customerPage.getByTestId("customer-login-submit").click();
  await customerPage.waitForURL("**/customer/orders");
  await customerPage.goto("/customer/notifications");
  await expect(customerPage.getByTestId("customer-account-nav")).toHaveCount(1);
  await expect(customerPage.getByRole("heading", { name: /My notifications|Мои уведомления|Thông báo của tôi/ })).toBeVisible();
  await customerPage.getByTestId("category-tab-SYSTEM").click();
  await expect(customerPage.getByTestId("empty-state-title")).toHaveText(/No new updates|Нет новых обновлений|Bạn chưa có cập nhật mới/);
  await expect(customerPage.getByTestId("empty-state-description")).toHaveText(/Notifications will appear here|Уведомления появятся здесь|Thông báo sẽ xuất hiện ở đây/);

  await adminContext.close().catch(() => undefined);
  await sellerContext.close().catch(() => undefined);
  await customerContext.close().catch(() => undefined);
});

test("Notification Center Public Guest Silence Check", async ({ browser }) => {
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();

  let notificationsApiQueried = false;
  await guestPage.route("**/api/**/notifications/**", async (route) => {
    notificationsApiQueried = true;
    await route.abort();
  });

  await guestPage.goto("/products");
  await guestPage.waitForTimeout(2000);
  expect(notificationsApiQueried).toBe(false);

  await guestContext.close().catch(() => undefined);
});
