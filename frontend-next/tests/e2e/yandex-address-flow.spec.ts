import { expect, test, type APIRequestContext } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

async function backendJson<T>(
  request: APIRequestContext,
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH";
    token?: string;
    data?: unknown;
  } = {},
) {
  const response = await request.fetch(`${backendBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: options.token ? { Authorization: `Bearer ${options.token}`, Cookie: "" } : undefined,
    data: options.data,
  });
  expect(response.ok(), `${options.method ?? "GET"} ${path} -> ${response.status()} ${await response.text()}`).toBeTruthy();
  return (await response.json()) as T;
}

async function createApprovedSeller(request: APIRequestContext, stamp: number) {
  const email = `yandex-address-seller-${stamp}@example.com`;
  const password = "password123";
  const seller = await backendJson<{ userId: string }>(request, "/api/auth/register", {
    method: "POST",
    data: { email, password, fullName: "Yandex Address Seller", role: "SELLER" },
  });
  const sellerLogin = await backendJson<{ accessToken: string }>(request, "/api/auth/seller/login", {
    method: "POST",
    data: { identifier: email, password },
  });

  await backendJson(request, "/api/seller/onboarding/profile", {
    method: "PUT",
    token: sellerLogin.accessToken,
    data: {
      legalType: "IP",
      legalName: "Yandex Address Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow",
      contactName: "Yandex Address Seller",
      contactPhone: "+79990000008",
      contactEmail: email,
    },
  });
  const document = await request.fetch(`${backendBaseUrl}/api/seller/onboarding/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerLogin.accessToken}` },
    multipart: {
      documentType: "INN",
      file: { name: "yandex-address.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") },
    },
  });
  expect(document.ok()).toBeTruthy();
  const documentJson = (await document.json()) as { id: string };
  const adminLogin = await backendJson<{ accessToken: string }>(request, "/api/auth/admin/login", {
    method: "POST",
    data: { identifier: "demo-admin@trawberry.local", password: "DemoAdmin123!" },
  });
  await backendJson(request, `/api/admin/sellers/${seller.userId}/documents/${documentJson.id}/approve`, {
    method: "POST",
    token: adminLogin.accessToken,
    data: {},
  });
  await backendJson(request, `/api/admin/sellers/${seller.userId}/approve`, {
    method: "POST",
    token: adminLogin.accessToken,
    data: {},
  });

  return { email, password, sellerToken: sellerLogin.accessToken };
}

async function createPublishedProduct(request: APIRequestContext, sellerToken: string, stamp: number) {
  const shop = await backendJson<{ id: string }>(request, "/api/shops", {
    method: "POST",
    token: sellerToken,
    data: { name: `Yandex Address Shop ${stamp}`, slug: `yandex-address-shop-${stamp}`, paymentInstructions: "Direct seller QR." },
  });
  await backendJson(request, `/api/shops/${shop.id}/delivery/settings`, {
    method: "PATCH",
    token: sellerToken,
    data: {
      pickupAddress: "Tverskaya 1",
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
      wbTitle: `Yandex Address Product ${stamp}`,
      localTitle: `Yandex Address Product ${stamp}`,
      localDescription: "Structured address E2E product",
      categoryName: "Structured Address Category",
      visibility: "ACTIVE",
      variants: [{ chrtId: 8900000 + (stamp % 100000), basePrice: 219, discountPrice: 219, stockQuantity: 5 }],
      images: [{ wbUrl: "https://example.com/yandex-address.jpg", localUrl: "https://example.com/yandex-address.jpg", isMain: true, sortOrder: 0 }],
    },
  });
  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/publish`, {
    method: "POST",
    token: sellerToken,
    data: {},
  });
  return { shopId: shop.id, productId: product.id };
}

test("structured Moscow address flows into checkout and seller Yandex workbench", async ({ page, request }) => {
  test.setTimeout(180000);
  const stamp = Date.now();
  const seller = await createApprovedSeller(request, stamp);
  const catalog = await createPublishedProduct(request, seller.sellerToken, stamp);

  const customerEmail = `yandex-address-customer-${stamp}@example.com`;
  const customerPhone = `+7996${String(stamp).slice(-7)}`;
  const password = "password123";

  await page.goto("/customer/register");
  await page.getByTestId("customer-register-name").fill("Yandex Address Customer");
  await page.getByTestId("customer-register-email").fill(customerEmail);
  await page.getByTestId("customer-register-password").fill(password);
  await page.getByTestId("customer-register-confirm-password").fill(password);
  await page.getByTestId("customer-register-submit").click();
  await page.waitForURL("**/customer/login?registered=1");
  await page.getByTestId("customer-login-email").fill(customerEmail);
  await page.getByTestId("customer-login-password").fill(password);
  await page.getByTestId("customer-login-submit").click();
  await page.waitForURL("**/customer/orders");

  await page.goto(`/products/${catalog.productId}`);
  await expect(page.getByTestId("public-address-link")).toHaveAttribute(
    "href",
    "/customer/account/addresses",
  );
  await expect(page.getByTestId("public-customer-link")).toHaveAttribute(
    "href",
    "/customer/account",
  );
  await page.goto("/customer/account/addresses");

  await page.goto(`/checkout?productId=${catalog.productId}`);
  await expect(page.getByTestId("checkout-address-required-banner")).toBeVisible();
  await expect(page.getByTestId("checkout-configure-addresses")).toBeVisible();
  await expect(page.getByTestId("checkout-submit")).toBeDisabled();

  await page.goto("/customer/account/addresses");
  await page.getByTestId("customer-address-fullName").fill("Yandex Address Customer");
  await page.getByTestId("customer-address-phone").fill(customerPhone);
  await page.getByTestId("customer-address-city").fill("Moscow");
  await page.getByTestId("customer-address-region").fill("Tverskoy District");
  await page.getByTestId("customer-address-street").fill("Tverskaya");
  await page.getByTestId("customer-address-building").fill("12");
  await page.getByTestId("customer-address-entrance").fill("2");
  await page.getByTestId("customer-address-intercom").fill("45B");
  await page.getByTestId("customer-address-no-floor").check();
  await page.getByTestId("customer-address-apartment").fill("73");
  await page.getByTestId("customer-address-comment").fill("Call 10 minutes before arrival");
  await page.getByTestId("customer-address-latitude").fill("55.765369");
  await page.getByTestId("customer-address-longitude").fill("37.605192");
  await page.getByTestId("customer-address-save").click();
  await expect(page.getByTestId("customer-address-card")).toHaveCount(1);
  await expect(page.getByTestId("customer-address-card")).toContainText(
    /Yandex-ready|Готово для Yandex/,
  );

  await page.goto(`/checkout?productId=${catalog.productId}`);
  await expect(page.getByTestId("checkout-saved-address-select")).toBeVisible();
  await expect(page.getByTestId("checkout-address-geo-status")).toContainText(
    /Yandex-ready|Готово для Yandex/,
  );
  await expect(page.getByTestId("checkout-submit")).toBeEnabled();
  await page.getByTestId("checkout-submit").click();
  await expect(page.getByTestId("checkout-confirmation")).toBeVisible();
  const confirmationText = await page.getByTestId("checkout-confirmation").innerText();
  const orderId =
    confirmationText.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    )?.[0] ?? "";
  expect(orderId).toBeTruthy();

  await page.goto("/customer/account");
  await page.getByTestId("customer-account-logout").click();
  await page.waitForURL(/\/customer\/login/);

  await page.goto("/login");
  await page.getByTestId("login-email").fill(seller.email);
  await page.getByTestId("login-password").fill(seller.password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/seller/dashboard");

  await page.goto(`/seller/orders/${orderId}`);
  await expect(page.getByText("Moscow, Tverskaya, 12", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Entrance 2").first()).toBeVisible();
  await expect(page.getByText("Intercom 45B").first()).toBeVisible();
});
