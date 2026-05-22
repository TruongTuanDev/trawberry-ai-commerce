import { expect, test, type APIRequestContext } from "@playwright/test";

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
    const body = await response.text();
    expect(response.ok(), `${options.method ?? "GET"} ${path} -> ${response.status()} ${body}`).toBeTruthy();
  }
  return (await response.json()) as T;
}

async function createApprovedSeller(request: APIRequestContext, email: string, password: string) {
  const seller = await backendJson<{ userId: string; approvalStatus: string }>(request, "/api/auth/register", {
    method: "POST",
    data: {
      email,
      password,
      fullName: "Seller Delivery Settings",
      role: "SELLER",
    },
  });
  expect(seller.approvalStatus).toBe("PENDING");

  const sellerLogin = await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
    method: "POST",
    data: { email, password },
  });

  await backendJson(request, "/api/seller/onboarding/profile", {
    method: "PUT",
    token: sellerLogin.accessToken,
    data: {
      legalType: "IP",
      legalName: "Seller Delivery Settings IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow, Delivery Settings Street 1",
      contactName: "Seller Delivery Settings",
      contactPhone: "+79990000008",
      contactEmail: email,
    },
  });

  const document = await backendJson<{ id: string }>(request, "/api/seller/onboarding/documents", {
    method: "POST",
    token: sellerLogin.accessToken,
    multipart: {
      documentType: "INN",
      file: {
        name: "seller-delivery-inn.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n% seller delivery settings\n"),
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

  const approvedSellerLogin = await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
    method: "POST",
    data: { email, password },
  });

  return approvedSellerLogin.accessToken;
}

test("seller configures delivery settings and creates same-city Yandex shipment from UI", async ({
  browser,
  page,
  request,
}) => {
  test.setTimeout(120000);

  const stamp = Date.now();
  const sellerEmail = `seller-delivery-settings-${stamp}@example.com`;
  const sellerPassword = "password123";
  const phone = `+7996${String(stamp).slice(-7)}`;
  const pickupAddress = `Tverskaya Street 7, Moscow ${stamp}`;

  const sellerToken = await createApprovedSeller(request, sellerEmail, sellerPassword);
  const shop = await backendJson<{ id: string; slug: string }>(request, "/api/shops", {
    method: "POST",
    token: sellerToken,
    data: {
      name: `Delivery Settings Shop ${stamp}`,
      slug: `delivery-settings-shop-${stamp}`,
      contactInfo: "+79990000008",
      paymentInstructions: "Manual transfer for seller delivery settings E2E.",
    },
  });
  expect(shop?.id).toBeTruthy();
  const product = await backendJson<{ id: string; shopId: string }>(request, `/api/shops/${shop.id}/products`, {
    method: "POST",
    token: sellerToken,
    data: {
      wbNmId: Number(String(stamp).slice(-9)),
      wbTitle: `Delivery Settings Product ${stamp}`,
      wbDescription: "Created for seller delivery settings browser E2E.",
      brand: "Delivery E2E",
      categoryName: "Delivery E2E",
      wbVendorCode: `delivery-${stamp}`,
      localTitle: `Delivery Settings Product ${stamp}`,
      localDescription: "Created for seller delivery settings browser E2E.",
      visibility: "ACTIVE",
      variants: [
        {
          chrtId: Number(String(stamp).slice(-9)) + 1,
          basePrice: 149,
          discountPrice: 149,
          stockQuantity: 5,
          lowStockThreshold: 1,
          trackInventory: true,
        },
      ],
      images: [
        {
          wbUrl: "https://example.com/seller-delivery-settings.jpg",
          localUrl: "https://example.com/seller-delivery-settings.jpg",
          isMain: true,
          sortOrder: 0,
        },
      ],
    },
  });

  await page.goto("/login");
  await page.getByTestId("login-email").fill(sellerEmail);
  await page.getByTestId("login-password").fill(sellerPassword);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/seller/dashboard");

  await page.goto("/seller/settings");
  await expect(page.getByTestId("seller-delivery-settings-page")).toBeVisible();
  await page.getByTestId("delivery-pickup-address").fill(pickupAddress);
  await page.getByTestId("delivery-pickup-city").fill("Moscow");
  await page.getByTestId("delivery-pickup-postal-code").fill("125009");
  await page.getByTestId("delivery-pickup-contact-name").fill("Demo Seller Delivery");
  await page.getByTestId("delivery-pickup-contact-phone").fill("+79990000000");
  await page.getByTestId("delivery-enabled-yandex").setChecked(true);
  await page.getByTestId("delivery-enabled-cdek").setChecked(true);
  await page.getByTestId("delivery-default-carrier").selectOption("YANDEX");
  await page.getByTestId("delivery-same-city-carrier").selectOption("YANDEX");
  await page.getByTestId("delivery-inter-city-carrier").selectOption("CDEK");
  await page.getByTestId("delivery-fallback-carrier").selectOption("CDEK");
  await page.getByTestId("delivery-default-weight-gram").fill("750");
  await page.getByTestId("delivery-default-length-cm").fill("24");
  await page.getByTestId("delivery-default-width-cm").fill("16");
  await page.getByTestId("delivery-default-height-cm").fill("9");
  await page.getByTestId("delivery-settings-save").click();
  await expect(page.getByTestId("delivery-settings-success")).toHaveText("Delivery settings saved.");

  await page.reload();
  await expect(page.getByTestId("seller-delivery-settings-page")).toBeVisible();
  await expect(page.getByTestId("delivery-pickup-address")).toHaveValue(pickupAddress);
  await expect(page.getByTestId("delivery-pickup-city")).toHaveValue("Moscow");
  await expect(page.getByTestId("delivery-enabled-yandex")).toBeChecked();
  await expect(page.getByTestId("delivery-enabled-cdek")).toBeChecked();
  await expect(page.getByTestId("delivery-same-city-carrier")).toHaveValue("YANDEX");
  await expect(page.getByTestId("delivery-inter-city-carrier")).toHaveValue("CDEK");
  await expect(page.getByTestId("delivery-fallback-carrier")).toHaveValue("CDEK");
  await expect(page.getByTestId("delivery-default-weight-gram")).toHaveValue("750");

  const checkout = await backendJson<{
    orderId: string;
    orderCode: string;
    trackingPath: string;
    customerPhone: string;
  }>(request, "/api/checkout/orders", {
    method: "POST",
    data: {
      shopId: product.shopId,
      items: [{ productId: product.id, quantity: 1 }],
      customer: {
        fullName: "Delivery Settings Customer",
        phone,
        email: "delivery-settings-customer@example.com",
        address: "Tverskaya Street 15, Moscow",
        note: `Seller delivery settings E2E ${stamp}`,
      },
      paymentMethod: "PREPAID_SELLER_QR",
    },
  });
  expect(checkout.orderId).toBeTruthy();
  expect(checkout.orderCode).toBeTruthy();

  await backendJson(request, `/api/public/orders/${checkout.orderId}/payment-proof`, {
    method: "POST",
    multipart: {
      phone,
      file: {
        name: "delivery-payment-proof.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=",
          "base64",
        ),
      },
    },
  });
  await backendJson(request, `/api/shops/${shop.id}/payments/${checkout.orderId}/mark-paid`, {
    method: "POST",
    token: sellerToken,
    data: { note: "Marked paid for seller delivery settings E2E." },
  });

  await page.goto(`/seller/orders/${checkout.orderId}`);
  await expect(page.getByText(checkout.orderCode)).toBeVisible();
  await expect(page.getByTestId("seller-order-delivery-section")).toBeVisible();
  await expect(page.getByTestId("delivery-order-pickup-address")).toHaveValue(pickupAddress);
  await expect(page.getByTestId("delivery-order-weight-gram")).toHaveValue("750");

  await page.getByTestId("delivery-calculate-offers").click();
  await expect(page.getByTestId("delivery-action-message")).toContainText("Loaded");
  const recommendedYandexOffer = page.getByTestId("delivery-offer-row").filter({
    hasText: /Provider: YANDEX[\s\S]*Recommended|Recommended[\s\S]*Provider: YANDEX/,
  });
  await expect(recommendedYandexOffer).toBeVisible();
  await expect(page.getByTestId("delivery-offer-select")).toHaveValue(/.+/);

  await page.getByTestId("delivery-create-shipment").click();
  await expect(page.getByTestId("delivery-action-message")).toHaveText("Delivery shipment created.");
  await expect(page.getByTestId("seller-delivery-provider")).toHaveText("YANDEX");
  await expect(page.getByTestId("seller-delivery-tracking-link")).toBeVisible();

  await page.getByTestId("delivery-refresh-shipment").click();
  await expect(page.getByTestId("delivery-action-message")).toHaveText("Delivery shipment refreshed.");
  await expect(page.getByTestId("seller-delivery-status")).toHaveText("IN_TRANSIT");

  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  await customerPage.goto(`/orders/${checkout.orderId}?phone=${encodeURIComponent(phone)}`);
  await expect(customerPage.getByTestId("tracked-order-page")).toBeVisible();
  await expect(customerPage.getByRole("heading", { name: checkout.orderCode })).toBeVisible();
  await expect(customerPage.getByTestId("tracked-delivery-provider")).toHaveText("YANDEX");
  await expect(customerPage.getByTestId("tracked-delivery-status")).toHaveText("IN_TRANSIT");
  await expect(customerPage.getByTestId("tracked-delivery-link")).toBeVisible();
  await customerContext.close();
});
