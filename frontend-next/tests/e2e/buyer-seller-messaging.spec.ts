import { expect, test, type APIRequestContext, type Browser } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

async function backendJson<T>(
  request: APIRequestContext,
  url: string,
  options?: Parameters<APIRequestContext["fetch"]>[1],
) {
  const response = await request.fetch(`${backendBaseUrl}${url}`, options);
  expect(
    response.ok(),
    `${options?.method ?? "GET"} ${url} -> ${response.status()}: ${await response.text()}`,
  ).toBeTruthy();
  return (await response.json()) as T;
}

async function approveSeller(request: APIRequestContext, email: string, password: string) {
  const register = await backendJson<{ userId: string }>(request, "/api/auth/register", {
    method: "POST",
    data: {
      email,
      password,
      fullName: "Messaging Seller",
      role: "SELLER",
    },
  });
  const sellerLogin = await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
    method: "POST",
    data: { email, password },
  });
  await backendJson(request, "/api/seller/onboarding/profile", {
    method: "PUT",
    headers: { Authorization: `Bearer ${sellerLogin.accessToken}` },
    data: {
      legalType: "IP",
      legalName: "Messaging Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow, Messaging Street 1",
      contactName: "Messaging Seller",
      contactPhone: "+79990000111",
      contactEmail: email,
    },
  });
  const document = await backendJson<{ id: string }>(request, "/api/seller/onboarding/documents", {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerLogin.accessToken}` },
    multipart: {
      documentType: "INN",
      file: {
        name: "seller-inn.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n% messaging e2e\n"),
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
  await backendJson(
    request,
    `/api/admin/sellers/${register.userId}/documents/${document.id}/approve`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${adminLogin.accessToken}` },
      data: {},
    },
  );
  await backendJson(request, `/api/admin/sellers/${register.userId}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminLogin.accessToken}` },
    data: {},
  });
  return sellerLogin.accessToken;
}

async function createShop(request: APIRequestContext, token: string, stamp: number) {
  return backendJson<{ id: string; slug: string; name: string }>(request, "/api/shops", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    data: {
      name: `Messaging Shop ${stamp}`,
      slug: `messaging-shop-${stamp}`,
      paymentInstructions: "Manual transfer",
    },
  });
}

async function createProduct(
  request: APIRequestContext,
  token: string,
  shopId: string,
  stamp: number,
) {
  const product = await backendJson<{ id: string }>(request, `/api/shops/${shopId}/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    data: {
      wbNmId: 9100000 + (stamp % 100000),
      wbTitle: `Messaging Product ${stamp}`,
      localTitle: `Messaging Product ${stamp}`,
      localDescription: "Messaging product description",
      categoryName: "Messaging Category",
      visibility: "ACTIVE",
      variants: [
        {
          chrtId: 9200000 + (stamp % 100000),
          techSize: "M",
          basePrice: 1750,
          stockQuantity: 8,
          trackInventory: true,
          isActive: true,
        },
      ],
      images: [
        {
          wbUrl: "https://example.com/messaging.jpg",
          localUrl: "https://example.com/messaging.jpg",
          isMain: true,
          sortOrder: 0,
        },
      ],
    },
  });

  await backendJson(request, `/api/shops/${shopId}/products/${product.id}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    data: {},
  });

  return product;
}

async function registerCustomer(
  request: APIRequestContext,
  email: string,
  password: string,
  stamp: number,
) {
  await backendJson(request, "/api/auth/register", {
    method: "POST",
    data: {
      email,
      password,
      fullName: "Messaging Customer",
      role: "CUSTOMER",
      phone: `+7995${String(stamp).slice(-7)}`,
    },
  });
}

async function loginSeller(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/seller/dashboard");
}

async function loginAdmin(page: Page) {
  await page.goto("/admin-login");
  await page.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
  await page.getByTestId("admin-login-password").fill("DemoAdmin123!");
  await page.getByTestId("admin-login-submit").click();
  await page.waitForURL("**/admin/dashboard");
}

async function switchLocale(page: Page, role: "customer" | "seller", locale: "ru" | "en" | "vi") {
  await page.getByTestId(`language-switcher-${role}`).first().click();
  await page.getByTestId(`language-option-${role}-${locale}`).click();
}

async function newPage(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  return page;
}

async function waitForSellerThreadRow(page: Page) {
  await expect
    .poll(async () => page.getByTestId("seller-message-thread-row").count(), {
      timeout: 15000,
    })
    .toBeGreaterThan(0);
}

test("buyer seller messaging MVP works across customer, seller, admin, and notifications", async ({
  browser,
  request,
}) => {
  test.setTimeout(240000);

  const stamp = Date.now();
  const sellerEmail = `messaging-seller-${stamp}@example.com`;
  const sellerPassword = "password123";
  const customerEmail = `messaging-customer-${stamp}@example.com`;
  const customerPassword = "password123";

  const sellerToken = await approveSeller(request, sellerEmail, sellerPassword);
  const shop = await createShop(request, sellerToken, stamp);
  const product = await createProduct(request, sellerToken, shop.id, stamp);
  await registerCustomer(request, customerEmail, customerPassword, stamp);

  const guestPage = await newPage(browser);
  await guestPage.goto(`/shops/${shop.slug}`);
  await expect(guestPage.getByTestId("public-shop-message-button")).toBeVisible();
  await guestPage.getByTestId("public-shop-message-button").click();
  await expect(guestPage).toHaveURL(/\/customer\/login\?/);
  await guestPage.close();

  const customerPage = await newPage(browser);
  await customerPage.goto(`/products/${product.id}`);
  await expect(customerPage.getByTestId("public-product-message-shop-button")).toBeVisible();
  await customerPage.goto(`/shops/${shop.slug}`);
  await customerPage.getByTestId("public-shop-message-button").click();
  await expect(customerPage).toHaveURL(/\/customer\/login\?/);

  await customerPage.getByTestId("customer-login-email").fill(customerEmail);
  await customerPage.getByTestId("customer-login-password").fill(customerPassword);
  await customerPage.getByTestId("customer-login-submit").click();
  await customerPage.waitForURL(/\/customer\/messages\/new\?/);
  await expect(customerPage.getByTestId("customer-new-message-page")).toBeVisible();
  await expect(customerPage.getByRole("heading", { name: "Новое сообщение", exact: true })).toBeVisible();

  await customerPage.getByTestId("language-switcher-customer").first().click();
  await expect(customerPage.getByTestId("language-option-customer-vi")).toHaveCount(0);
  await customerPage.keyboard.press("Escape");

  await customerPage.getByTestId("customer-new-message-input").fill("Здравствуйте, есть ли быстрая доставка?");
  await customerPage.getByTestId("customer-new-message-submit").click();
  await customerPage.waitForURL(/\/customer\/messages\/.+/);
  await expect(customerPage.getByTestId("customer-message-thread-page")).toBeVisible();
  await expect(customerPage.getByTestId("message-thread-messages")).toContainText("Здравствуйте, есть ли быстрая доставка?");

  await customerPage.goto("/customer/notifications");
  await expect(customerPage.getByTestId("notifications-page")).toBeVisible();

  await switchLocale(customerPage, "customer", "en");
  await expect(customerPage.getByRole("heading", { name: "My notifications", exact: true })).toBeVisible();
  await customerPage.goto("/customer/messages");
  await expect(customerPage.getByRole("heading", { name: "Messages", exact: true })).toBeVisible();

  const sellerPage = await newPage(browser);
  await loginSeller(sellerPage, sellerEmail, sellerPassword);
  await sellerPage.goto("/seller/notifications");
  await expect(sellerPage.getByTestId("notification-item").first()).toBeVisible();

  await sellerPage.goto("/seller/messages");
  await expect(sellerPage.getByTestId("seller-messages-page")).toBeVisible();
  await waitForSellerThreadRow(sellerPage);
  await expect(sellerPage.getByTestId("seller-message-thread-row").first()).toBeVisible();
  await switchLocale(sellerPage, "seller", "vi");
  await expect(sellerPage.getByRole("heading", { name: "Tin nhắn", exact: true })).toBeVisible();
  await switchLocale(sellerPage, "seller", "en");
  await expect(sellerPage.getByRole("heading", { name: "Messages", exact: true })).toBeVisible();

  await sellerPage.getByTestId("seller-message-thread-row").first().click();
  await expect(sellerPage.getByTestId("seller-message-thread-page")).toBeVisible();
  await sellerPage.getByTestId("seller-message-composer-input").fill("Yes, we can dispatch the same day.");
  await sellerPage.getByTestId("seller-message-composer-submit").click();
  await expect(sellerPage.getByTestId("message-thread-messages")).toContainText("Yes, we can dispatch the same day.");

  await customerPage.goto("/customer/messages");
  await customerPage.getByTestId("customer-message-thread-row").first().click();
  await expect(customerPage.getByTestId("message-thread-messages")).toContainText("Yes, we can dispatch the same day.");
  await customerPage.getByTestId("customer-report-thread").click();
  await expect(customerPage.getByTestId("message-thread-view")).toContainText("Reported");

  const adminPage = await newPage(browser);
  await loginAdmin(adminPage);
  await adminPage.goto("/admin/messages");
  await expect(adminPage.getByTestId("admin-messages-page")).toBeVisible();
  await expect(adminPage.getByTestId("admin-message-thread-row").first()).toContainText("REPORTED");
  await adminPage.getByTestId("admin-message-thread-row").first().click();
  await expect(adminPage.getByTestId("admin-message-thread-page")).toBeVisible();
  await expect(adminPage.getByTestId("message-thread-view")).toContainText("Reported");

});
