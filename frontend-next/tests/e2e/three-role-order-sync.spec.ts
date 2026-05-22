import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";

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

async function safeClose(context: BrowserContext) {
  try {
    await context.close();
  } catch {
    // Windows Playwright artifacts can race on close; irrelevant to the flow assertion.
  }
}

test("customer, seller, and admin stay synchronized through payment, delivery, and finance", async ({
  browser,
  page,
  request,
}) => {
  test.setTimeout(180000);

  const stamp = Date.now();
  const sellerEmail = `three-role-seller-${stamp}@example.com`;
  const sellerPassword = "password123";
  const customerEmail = `three-role-customer-${stamp}@example.com`;
  const customerPassword = "password123";
  const buyerPhone = `+7995${String(stamp).slice(-7)}`;
  const productNmId = 8100000 + (stamp % 100000);

  const sellerRegister = await backendJson<{ userId: string }>(request, "/api/auth/register", {
    method: "POST",
    data: {
      email: sellerEmail,
      password: sellerPassword,
      fullName: "Three Role Seller",
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
      legalName: "Three Role Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow",
      contactName: "Three Role Seller",
      contactPhone: "+79990000073",
      contactEmail: sellerEmail,
    },
  });
  const sellerDocument = await backendJson<{ id: string }>(request, "/api/seller/onboarding/documents", {
    method: "POST",
    token: sellerLogin.accessToken,
    multipart: {
      documentType: "INN",
      file: {
        name: "three-role.pdf",
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
    data: {},
  });
  await backendJson(request, `/api/admin/sellers/${sellerRegister.userId}/approve`, {
    method: "POST",
    token: adminLogin.accessToken,
    data: {},
  });

  const shop = await backendJson<{ id: string }>(request, "/api/shops", {
    method: "POST",
    token: sellerLogin.accessToken,
    data: {
      name: `Three Role Shop ${stamp}`,
      slug: `three-role-shop-${stamp}`,
    },
  });

  await backendJson(request, `/api/shops/${shop.id}/payment-settings`, {
    method: "PATCH",
    token: sellerLogin.accessToken,
    data: {
      paymentMode: "STATIC_QR",
      status: "READY",
      bankName: "T-Bank",
      recipientName: "Three Role Seller",
      recipientPhone: "+79990000073",
      recipientAccount: "40817810000000000773",
      sbpPhone: "+79990000073",
      paymentInstruction: "Pay the seller directly by QR.",
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
      pickupContactPhone: "+79990000073",
      pickupContactName: "Three Role Seller",
      enabledCarriers: ["YANDEX", "CDEK"],
      defaultCarrier: "YANDEX",
      sameCityPreferredCarrier: "YANDEX",
      interCityPreferredCarrier: "CDEK",
      fallbackCarrier: "CDEK",
      defaultWeightGram: 700,
      defaultLengthCm: 35,
      defaultWidthCm: 25,
      defaultHeightCm: 8,
    },
  });
  await backendJson(request, `/api/admin/finance/shops/${shop.id}/commission`, {
    method: "PATCH",
    token: adminLogin.accessToken,
    data: { commissionPercent: 3 },
  });

  const product = await backendJson<{ id: string }>(request, `/api/shops/${shop.id}/products`, {
    method: "POST",
    token: sellerLogin.accessToken,
    data: {
      wbNmId: productNmId,
      wbTitle: `Three Role Product ${stamp}`,
      localTitle: `Three Role Product ${stamp}`,
      localDescription: "Three role sync product",
      categoryName: "Three Role Category",
      visibility: "ACTIVE",
      variants: [
        {
          chrtId: productNmId + 1,
          techSize: "Default",
          basePrice: 320,
          stockQuantity: 5,
          trackInventory: true,
          isActive: true,
        },
      ],
      images: [
        {
          wbUrl: "https://example.com/three-role.jpg",
          localUrl: "https://example.com/three-role.jpg",
          isMain: true,
          sortOrder: 0,
        },
      ],
    },
  });
  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/publish`, {
    method: "POST",
    token: sellerLogin.accessToken,
    data: {},
  });

  await backendJson(request, "/api/auth/register", {
    method: "POST",
    data: {
      email: customerEmail,
      password: customerPassword,
      fullName: "Three Role Customer",
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

  await customerPage.goto(`/products/${product.id}`);
  await customerPage.getByTestId("continue-to-checkout").click();
  await customerPage.waitForURL(/\/checkout/);
  await customerPage.getByTestId("checkout-address").fill("Moscow, Sync Street 5");
  await customerPage.getByTestId("checkout-note").fill("Three role sync checkout");
  await customerPage.getByTestId("checkout-submit").click();
  await expect(customerPage.getByTestId("checkout-confirmation")).toBeVisible();
  const confirmationText = await customerPage.getByTestId("checkout-confirmation").innerText();
  const checkoutCode = confirmationText.match(/CHK-\d+-\d+/)?.[0] ?? "";
  const orderId =
    confirmationText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0] ?? "";
  expect(checkoutCode).toBeTruthy();
  expect(orderId).toBeTruthy();

  await customerPage.goto("/customer/orders");
  await expect(customerPage.getByText(checkoutCode)).toBeVisible();

  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await sellerPage.goto("/login");
  await sellerPage.getByTestId("login-email").fill(sellerEmail);
  await sellerPage.getByTestId("login-password").fill(sellerPassword);
  await sellerPage.getByTestId("login-submit").click();
  await sellerPage.waitForURL("**/seller/dashboard");
  await sellerPage.goto("/seller/orders");
  await sellerPage.getByPlaceholder("Search by order, customer, phone, product").fill(buyerPhone);
  await expect(sellerPage.getByTestId("seller-order-card")).toContainText("New order");
  await sellerPage.goto(`/seller/orders/${orderId}`);
  await expect(sellerPage.getByTestId("seller-order-next-action")).toContainText(/Wait for payment|Confirm or reject payment proof|No action/);

  await backendJson(request, `/api/public/orders/${orderId}/payment-proof`, {
    method: "POST",
    multipart: {
      phone: buyerPhone,
      buyerNote: "Transferred by QR after checkout.",
      file: {
        name: "three-role-proof.png",
        mimeType: "image/png",
        buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=", "base64"),
      },
    },
  });

  await sellerPage.goto("/seller/payments-to-confirm");
  await sellerPage
    .getByPlaceholder("Search by order, customer, payment method")
    .fill(buyerPhone);
  await expect(sellerPage.getByText("Three Role Customer")).toBeVisible();
  await expect(sellerPage.getByText("BUYER_MARKED_PAID")).toBeVisible();

  await page.goto("/admin-login");
  await page.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
  await page.getByTestId("admin-login-password").fill("DemoAdmin123!");
  await page.getByTestId("admin-login-submit").click();
  await page.waitForURL("**/admin/dashboard");
  await page.goto("/admin/payments-supervision");
  await page.getByLabel("Payment status").selectOption("PENDING");
  await expect(page.getByTestId("admin-payments-supervision-page")).toContainText("Three Role Customer");
  await expect(page.getByTestId("admin-payments-supervision-page")).toContainText("BUYER_MARKED_PAID");

  await backendJson(request, `/api/shops/${shop.id}/payments/${orderId}/confirm`, {
    method: "POST",
    token: sellerLogin.accessToken,
    data: { note: "Seller confirmed direct payment." },
  });

  await page.goto("/admin/finance/seller-fees");
  await expect(page.getByTestId("admin-seller-fees-page")).toContainText(shop.name);
  const platformFeeDueText =
    (await page.getByTestId(`admin-platform-fee-due-${shop.id}`).textContent()) ?? "";
  const normalizedPlatformFeeDue = Number(
    platformFeeDueText.replace(/[^\d,.-]/g, "").replace(",", "."),
  );
  expect(normalizedPlatformFeeDue).toBeGreaterThan(0);

  await sellerPage.goto(`/seller/orders/${orderId}`);
  await expect(sellerPage.getByTestId("seller-order-display-status")).toContainText(/Ready to create Yandex|Payment confirmed/);
  await sellerPage.getByTestId("manual-yandex-order-id").fill(`YANDEX-${stamp}`);
  await sellerPage.getByTestId("manual-delivery-save").click();
  await expect(sellerPage.getByTestId("delivery-action-message")).toContainText(/saved|updated/i);
  await sellerPage.getByTestId("manual-delivery-mark-delivered").click();
  await expect(sellerPage.getByTestId("delivery-action-message")).toContainText(/delivered/i);

  await customerPage.goto(`/customer/orders/${checkoutCode}`);
  await expect(customerPage.getByTestId("receipt-order-card")).toContainText("DELIVERED");

  await safeClose(sellerContext);
  await safeClose(customerContext);
});
