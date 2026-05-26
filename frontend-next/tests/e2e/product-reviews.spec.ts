import fs from "fs";
import path from "path";
import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";
const frontendBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const enDict = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../src/i18n/dictionaries/en.json"), "utf-8"),
);
const ruDict = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../src/i18n/dictionaries/ru.json"), "utf-8"),
);
const viDict = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../src/i18n/dictionaries/vi.json"), "utf-8"),
);

const tinyReviewImage = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=",
  "base64",
);

async function backendJson<T>(
  request: APIRequestContext,
  url: string,
  options?: Parameters<APIRequestContext["fetch"]>[1],
) {
  let response = await request.fetch(`${backendBaseUrl}${url}`, options);
  for (let attempt = 0; response.status() === 429 && attempt < 5; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    response = await request.fetch(`${backendBaseUrl}${url}`, options);
  }
  expect(
    response.ok(),
    `${options?.method ?? "GET"} ${url} -> ${response.status()}: ${await response.text()}`,
  ).toBeTruthy();
  return (await response.json()) as T;
}

async function newPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ baseURL: frontendBaseUrl });
  await context.clearCookies();
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  return page;
}

async function approveSeller(
  request: APIRequestContext,
  email: string,
  fullName: string,
) {
  const password = "password123";
  const register = await backendJson<{ userId: string }>(request, "/api/auth/register", {
    method: "POST",
    data: { email, password, fullName, role: "SELLER" },
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
      legalName: `${fullName} IP`,
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow, Review Street 1",
      contactName: fullName,
      contactPhone: "+79990000066",
      contactEmail: email,
    },
  });
  const document = await backendJson<{ id: string }>(request, "/api/seller/onboarding/documents", {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerLogin.accessToken}` },
    multipart: {
      documentType: "INN",
      file: {
        name: "review-seller.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n% product reviews e2e\n"),
      },
    },
  });
  const adminLogin = await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
    method: "POST",
    data: { email: "demo-admin@trawberry.local", password: "DemoAdmin123!" },
  });
  await backendJson(request, `/api/admin/sellers/${register.userId}/documents/${document.id}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminLogin.accessToken}` },
    data: {},
  });
  await backendJson(request, `/api/admin/sellers/${register.userId}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminLogin.accessToken}` },
    data: {},
  });

  return {
    email,
    password,
    token: sellerLogin.accessToken,
    adminToken: adminLogin.accessToken,
  };
}

async function createPublicProduct(
  request: APIRequestContext,
  token: string,
  stamp: number,
) {
  const shop = await backendJson<{ id: string; slug: string; name: string }>(request, "/api/shops", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    data: {
      name: `Review Shop ${stamp}`,
      slug: `review-shop-${stamp}`,
      paymentInstructions: "Pay the seller directly by QR.",
    },
  });

  await backendJson(request, `/api/shops/${shop.id}/payment-settings`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    data: {
      paymentMode: "STATIC_QR",
      status: "READY",
      bankName: "T-Bank",
      recipientName: "Review Seller",
      recipientPhone: "+79990000066",
      recipientAccount: "40817810000000000666",
      sbpPhone: "+79990000066",
      paymentInstruction: "Pay the seller directly by QR.",
      allowPrepaidQr: true,
      allowPayOnDeliverySellerQr: true,
      allowDepositPayment: false,
    },
  });

  await backendJson(request, `/api/shops/${shop.id}/delivery/settings`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    data: {
      pickupAddress: "Tverskaya 5, Moscow",
      pickupCity: "Moscow",
      pickupPostalCode: "125009",
      pickupContactPhone: "+79990000066",
      pickupContactName: "Review Seller",
      pickupLatitude: 55.7558,
      pickupLongitude: 37.6173,
      enabledCarriers: ["YANDEX", "CDEK"],
      defaultCarrier: "YANDEX",
      sameCityPreferredCarrier: "YANDEX",
      interCityPreferredCarrier: "CDEK",
      fallbackCarrier: "CDEK",
      defaultWeightGram: 900,
      defaultLengthCm: 35,
      defaultWidthCm: 25,
      defaultHeightCm: 8,
    },
  });

  const product = await backendJson<{ id: string; variants: Array<{ id: string }> }>(
    request,
    `/api/shops/${shop.id}/products`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Cookie: "" },
      data: {
        wbNmId: 7700000 + (stamp % 100000),
        wbTitle: `Review Product ${stamp}`,
        localTitle: `Review Product ${stamp}`,
        localDescription: "Verified review test product",
        categoryName: "Review Category",
        visibility: "ACTIVE",
        variants: [
          {
            chrtId: 8700000 + (stamp % 100000),
            techSize: "Default",
            basePrice: 1499,
            stockQuantity: 5,
            trackInventory: true,
            isActive: true,
          },
        ],
      },
    },
  );

  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    multipart: {
      files: {
        name: "review-product.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=",
          "base64",
        ),
      },
    },
  });

  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    data: {},
  });

  return { shop, product };
}

async function loginCustomer(page: Page, email: string, password: string) {
  await page.goto("/customer/login");
  await page.getByTestId("customer-login-email").fill(email);
  await page.getByTestId("customer-login-password").fill(password);
  await page.getByTestId("customer-login-submit").click();
  await page.waitForURL("**/customer/orders");
}

async function loginSeller(page: Page, email: string, password: string) {
  await page.goto("/seller/login");
  await page.getByTestId("seller-login-email").fill(email);
  await page.getByTestId("seller-login-password").fill(password);
  await page.getByTestId("seller-login-submit").click();
  await page.waitForURL("**/seller/dashboard");
}

async function loginAdmin(page: Page) {
  await page.goto("/admin-login");
  await page.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
  await page.getByTestId("admin-login-password").fill("DemoAdmin123!");
  await page.getByTestId("admin-login-submit").click();
  await page.waitForURL("**/admin/dashboard");
}

async function createCustomerAddress(page: Page, phone: string) {
  await page.goto("/customer/account/addresses");
  await page.getByTestId("customer-address-fullName").fill("Review Customer");
  await page.getByTestId("customer-address-phone").fill(phone);
  await page.getByTestId("customer-address-city").fill("Moscow");
  await page.getByTestId("customer-address-region").fill("Moscow");
  await page.getByTestId("customer-address-street").fill("Review Street");
  await page.getByTestId("customer-address-building").fill("12");
  await page.getByTestId("customer-address-entrance").fill("1");
  await page.getByTestId("customer-address-floor").fill("3");
  await page.getByTestId("customer-address-apartment").fill("9");
  await page.getByTestId("customer-address-latitude").fill("55.7558");
  await page.getByTestId("customer-address-longitude").fill("37.6173");
  await page.getByTestId("customer-address-save").click();
  await expect(page.getByTestId("customer-address-card")).toHaveCount(1);
}

async function placeOrder(page: Page, productId: string) {
  await page.goto(`/products/${productId}`);
  await page.getByTestId("continue-to-checkout").click();
  await expect(page).toHaveURL(/\/checkout$/);
  await page.getByTestId("checkout-submit").click();
  await expect(page.getByTestId("checkout-confirmation")).toBeVisible({ timeout: 20000 });
  const text = await page.getByTestId("checkout-confirmation").innerText();
  const checkoutCode = text.match(/CHK-\d+-\d+/)?.[0] ?? "";
  const orderId =
    text.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    )?.[0] ?? "";

  expect(checkoutCode).toBeTruthy();
  expect(orderId).toBeTruthy();
  return { checkoutCode, orderId };
}

async function fulfillOrderForReview(
  request: APIRequestContext,
  sellerToken: string,
  shopId: string,
  orderId: string,
  phone: string,
  stamp: number,
) {
  await backendJson(request, `/api/shops/${shopId}/payments/${orderId}/mark-paid`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerToken}`, Cookie: "" },
    data: { note: "Paid and ready for verified review." },
  });

  const shipment = await backendJson<{ id: string }>(
    request,
    `/api/shops/${shopId}/orders/${orderId}/delivery/manual`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${sellerToken}`, Cookie: "" },
      data: {
        provider: "YANDEX",
        manualYandexOrderId: `YANDEX-${stamp}`,
        trackingNumber: `TRACK-${stamp}`,
        trackingUrl: `https://track.example/reviews/${stamp}`,
        courierName: "Courier Ivan",
        courierPhone: "+79991112233",
        recipientName: "Review Customer",
        recipientPhone: phone,
        deliveryNote: "Created manually for verified review test.",
      },
    },
  );

  await backendJson(
    request,
    `/api/shops/${shopId}/orders/${orderId}/delivery/shipments/${shipment.id}/mark-delivered`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${sellerToken}`, Cookie: "" },
      data: { note: "Delivered for verified review flow." },
    },
  );
}

async function switchCustomerLocale(page: Page, locale: "ru" | "en") {
  await page.getByTestId("language-switcher-customer").first().click();
  await page.getByTestId(`language-option-customer-${locale}`).click();
}

async function switchSellerLocale(page: Page, locale: "ru" | "en" | "vi") {
  const responsePromise = page.waitForResponse("**/api/users/locale");
  await page.getByTestId("language-switcher-seller").first().click();
  await page.getByTestId(`language-option-seller-${locale}`).click();
  await responsePromise;
}

test("verified product reviews flow works across customer, public, seller, and admin surfaces", async ({
  browser,
  page,
  request,
}) => {
  test.setTimeout(240000);

  const stamp = Date.now();
  const seller = await approveSeller(request, `review-seller-${stamp}@example.com`, "Review Seller");
  const { shop, product } = await createPublicProduct(request, seller.token, stamp);
  const customerEmail = `review-customer-${stamp}@example.com`;
  const customerPassword = "password123";
  const phone = `+7993${String(stamp).slice(-7)}`;

  await page.goto("/customer/register");
  await page.getByTestId("customer-register-name").fill("Review Customer");
  await page.getByTestId("customer-register-email").fill(customerEmail);
  await page.getByTestId("customer-register-password").fill(customerPassword);
  await page.getByTestId("customer-register-confirm-password").fill(customerPassword);
  await page.getByTestId("customer-register-submit").click();
  await page.waitForURL("**/customer/login?registered=1");

  await loginCustomer(page, customerEmail, customerPassword);
  await createCustomerAddress(page, phone);
  const { checkoutCode, orderId } = await placeOrder(page, product.id);

  await fulfillOrderForReview(request, seller.token, shop.id, orderId, phone, stamp);

  await page.goto(`/customer/orders/${checkoutCode}`);
  await expect(page.getByTestId("checkout-receipt")).toBeVisible();
  await expect(page.getByTestId("customer-write-review-button").first()).toBeVisible();
  await page.getByTestId("customer-write-review-button").first().click();
  await expect(page.getByTestId("customer-review-rating").getByRole("button")).toHaveCount(5);
  await expect(page.getByTestId("customer-review-comment")).toBeVisible();
  await expect(page.getByTestId("customer-review-add-photos")).toContainText(ruDict.customer.reviews.addPhotos);
  await expect(page.locator("body")).not.toContainText("????");
  await expect(page.locator("body")).not.toContainText("Chọn tệp");
  await page.getByTestId("customer-review-submit").click();
  await expect(page.locator("body")).toContainText(ruDict.customer.reviews.ratingRequired);
  await page.getByTestId("customer-review-rating").getByRole("button").nth(4).click();
  await page.getByTestId("customer-review-submit").click();
  await expect(page.locator("body")).toContainText(ruDict.customer.reviews.commentRequired);

  await page.getByTestId("customer-review-image-input").setInputFiles({
    name: "review.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not-an-image"),
  });
  await expect(page.locator("body")).toContainText(ruDict.errors.REVIEW_IMAGE_TYPE_INVALID);

  await page.getByTestId("customer-review-image-input").setInputFiles(
    Array.from({ length: 6 }, (_, index) => ({
      name: `review-${index}.png`,
      mimeType: "image/png",
      buffer: tinyReviewImage,
    })),
  );
  await expect(page.locator("body")).toContainText(ruDict.errors.REVIEW_IMAGE_LIMIT_EXCEEDED);

  await page.getByTestId("customer-review-fit-feedback").selectOption("TRUE_TO_SIZE");
  await page.getByTestId("customer-review-comment").fill("Excellent quality and fast delivery.");
  await page.getByTestId("customer-review-image-input").setInputFiles({
    name: "review-image.png",
    mimeType: "image/png",
    buffer: tinyReviewImage,
  });
  await expect(page.getByTestId("customer-review-pending-images")).toBeVisible();
  await page.getByTestId("customer-review-submit").click();
  await expect(page.getByTestId("customer-edit-review-button").first()).toBeVisible();

  await page.goto(`/products/${product.id}`);
  await expect(page.getByTestId("public-product-reviews")).toBeVisible();
  await expect(page.getByRole("heading", { name: ruDict.public.reviews.title, exact: true })).toBeVisible();
  await expect(page.getByTestId("public-product-reviews-list")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("public-review-card")).toContainText("Excellent quality and fast delivery.");
  await expect(page.getByText(ruDict.public.reviews.verifiedPurchase).first()).toBeVisible();
  await expect(page.getByTestId("public-review-image-thumbnail").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("????");

  await switchCustomerLocale(page, "en");
  await expect(page.getByRole("heading", { name: enDict.public.reviews.title, exact: true })).toBeVisible();
  await expect(page.getByText(enDict.public.reviews.verifiedPurchase).first()).toBeVisible();

  await page.goto("/products");
  await expect(page.getByTestId(`product-rating-summary-${product.id}`)).toContainText("5.0");
  await expect(page.getByTestId(`product-shop-link-${product.id}`)).toBeVisible();

  await page.goto(`/shops/${shop.slug}`);
  await expect(page.getByTestId("public-shop-header")).toContainText(shop.name);
  await expect(page.getByTestId("public-shop-header")).toContainText("5.0");
  await page.getByTestId("public-shop-message-button").click();

  const sellerPage = await newPage(browser);
  await loginSeller(sellerPage, seller.email, seller.password);
  await sellerPage.goto("/seller/reviews");
  await expect(sellerPage.getByTestId("seller-reviews-page")).toBeVisible();
  await expect(sellerPage.getByRole("heading", { name: ruDict.seller.reviews.title, exact: true })).toBeVisible();
  await switchSellerLocale(sellerPage, "vi");
  await expect(sellerPage.getByRole("heading", { name: viDict.seller.reviews.title, exact: true })).toBeVisible();
  await switchSellerLocale(sellerPage, "en");
  await expect(sellerPage.getByRole("heading", { name: enDict.seller.reviews.title, exact: true })).toBeVisible();
  await expect(sellerPage.getByTestId("seller-review-image-thumbnail").first()).toBeVisible();
  await sellerPage.getByTestId("seller-review-reply-input").first().fill("Thanks for the feedback from our shop.");
  await sellerPage.getByTestId("seller-review-reply-submit").first().click();
  await expect(sellerPage.getByTestId("seller-review-row").first()).toContainText("Thanks for the feedback from our shop.");

  await page.goto(`/products/${product.id}`);
  await expect(page.getByTestId("public-product-reviews-list")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("public-review-card").first()).toContainText("Thanks for the feedback from our shop.");

  const adminPage = await newPage(browser);
  await loginAdmin(adminPage);
  await adminPage.goto("/admin/reviews");
  await expect(adminPage.getByTestId("admin-reviews-page")).toBeVisible();
  await adminPage.getByTestId("admin-reviews-search").fill(`Review Product ${stamp}`);
  await expect(adminPage.getByTestId("admin-review-image-thumbnail").first()).toBeVisible();
  await adminPage.getByTestId("admin-review-hide").first().click();
  await expect(adminPage.getByTestId("admin-review-status").first()).toContainText("HIDDEN");

  await page.goto(`/products/${product.id}`);
  await expect(page.getByTestId("public-product-reviews-empty").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Excellent quality and fast delivery.");

  await adminPage.getByTestId("admin-review-restore").first().click();
  await expect(adminPage.getByTestId("admin-review-status").first()).toContainText("PUBLISHED");

  await page.goto(`/products/${product.id}`);
  await expect(page.getByTestId("public-product-reviews-list")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("public-review-card")).toContainText("Excellent quality and fast delivery.");
  await expect(page.getByTestId("public-review-image-thumbnail").first()).toBeVisible();

  await sellerPage.close();
  await adminPage.close();
});
