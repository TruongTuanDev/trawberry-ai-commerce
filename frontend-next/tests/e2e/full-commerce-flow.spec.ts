import { expect, test, type APIRequestContext } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

const demoSeller = {
  email: "demo-seller@trawberry.local",
  password: "DemoSeller123!",
};

async function backendJson<T>(
  request: APIRequestContext,
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH";
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

  expect(response.ok(), `${options.method ?? "GET"} ${path} -> ${response.status()}`).toBeTruthy();
  return (await response.json()) as T;
}

test("full seller-to-customer commerce flow covers payment, delivery, and fulfillment", async ({ browser, request }) => {
  test.setTimeout(120000);

  const login = await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
    method: "POST",
    data: demoSeller,
  });

  const shops = await backendJson<Array<{ id: string; slug: string }>>(request, "/api/shops", {
    token: login.accessToken,
  });
  const shop = shops.find((item) => item.slug === "demo-marketplace-shop") ?? shops[0];
  expect(shop?.id).toBeTruthy();

  await backendJson(request, `/api/shops/${shop.id}/delivery/settings`, {
    method: "PATCH",
    token: login.accessToken,
    data: {
      pickupAddress: "Tverskaya Street 7, Moscow",
      pickupCity: "Moscow",
      pickupPostalCode: "125009",
      pickupContactPhone: "+79990000000",
      pickupContactName: "Demo Seller",
      enabledCarriers: ["YANDEX", "CDEK"],
      defaultCarrier: "YANDEX",
      sameCityPreferredCarrier: "YANDEX",
      interCityPreferredCarrier: "CDEK",
      fallbackCarrier: "CDEK",
      defaultWeightGram: 500,
      defaultLengthCm: 20,
      defaultWidthCm: 15,
      defaultHeightCm: 8,
    },
  });

  const productSearch = await backendJson<{
    items: Array<{ id: string; availableQuantity: number }>;
  }>(request, "/api/public/products?search=Studio%20Canvas%20Jacket&size=1");
  const product = productSearch.items[0];
  expect(product?.id).toBeTruthy();
  const stockBefore = product.availableQuantity;

  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  const phone = `+7998${Date.now().toString().slice(-7)}`;

  await customerPage.goto("/products");
  await customerPage.getByLabel("Search catalog").fill("Studio Canvas Jacket");
  await customerPage.getByRole("button", { name: "Search" }).click();
  const productCard = customerPage.getByTestId("product-card").filter({ hasText: "Studio Canvas Jacket" });
  await expect(productCard).toHaveCount(1);
  await productCard.getByRole("link", { name: "View" }).click();

  await expect(customerPage.getByRole("heading", { name: "Studio Canvas Jacket" })).toBeVisible();
  await customerPage.getByTestId("continue-to-checkout").click();

  await customerPage.waitForURL(/\/checkout/);
  await customerPage.getByTestId("checkout-full-name").fill("Full Flow Customer");
  await customerPage.getByTestId("checkout-phone").fill(phone);
  await customerPage.getByTestId("checkout-email").fill("full-flow-customer@example.com");
  await customerPage.getByTestId("checkout-address").fill("Tverskaya Street 15, Moscow");
  await customerPage.getByTestId("checkout-note").fill(`Full commerce E2E ${phone}`);
  await customerPage.getByTestId("checkout-submit").click();

  await expect(customerPage.getByTestId("checkout-confirmation")).toBeVisible();
  const confirmationText = await customerPage.getByTestId("checkout-confirmation").innerText();
  const orderCode = confirmationText.match(/ORD-\d+-\d+/)?.[0] ?? "";
  const orderId =
    confirmationText.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    )?.[0] ?? "";
  expect(orderCode).toBeTruthy();
  expect(orderId).toBeTruthy();

  const productAfterCheckout = await backendJson<{ availableQuantity: number }>(
    request,
    `/api/public/products/${product.id}`,
  );
  expect(productAfterCheckout.availableQuantity).toBe(stockBefore - 1);

  await customerPage.getByTestId("confirmation-track-link").click();
  await expect(customerPage.getByTestId("tracked-order-page")).toBeVisible();
  await expect(customerPage.getByTestId("tracked-payment-status")).toHaveText("PENDING");

  await customerPage.getByTestId("payment-proof-input").setInputFiles({
    name: "payment-proof.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await customerPage.getByTestId("payment-proof-submit").click();
  await expect(customerPage.getByTestId("tracked-payment-proof-link")).toBeVisible();

  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();

  await sellerPage.goto("/login");
  await sellerPage.getByTestId("login-email").fill(demoSeller.email);
  await sellerPage.getByTestId("login-password").fill(demoSeller.password);
  await sellerPage.getByTestId("login-submit").click();
  await sellerPage.waitForURL("**/seller/dashboard");

  await sellerPage.goto("/seller/payments-to-confirm");
  await expect(sellerPage.getByText(orderCode)).toBeVisible();
  await sellerPage.getByRole("link", { name: orderCode }).click();
  await expect(sellerPage.getByTestId("seller-payment-detail-page")).toBeVisible();
  await expect(sellerPage.getByTestId("seller-payment-proof-link")).toBeVisible();
  sellerPage.once("dialog", (dialog) => dialog.accept());
  await sellerPage.getByTestId("seller-mark-paid-button").click();
  await expect(sellerPage.getByTestId("seller-payment-status")).toHaveAttribute("data-status", "PAID");

  await sellerPage.goto("/seller/orders");
  await sellerPage.getByPlaceholder("Search by order, customer, phone, product").fill(orderCode);
  await expect(sellerPage.getByRole("link", { name: orderCode })).toBeVisible();
  await sellerPage.getByRole("link", { name: orderCode }).click();
  await expect(sellerPage).toHaveURL(new RegExp(`/seller/orders/${orderId}`));
  await expect(sellerPage.getByText(orderCode)).toBeVisible();

  await sellerPage.goto(`/seller/orders/${orderId}`);
  await sellerPage.getByRole("button", { name: "Calculate offers" }).click();
  await expect(sellerPage.getByTestId("delivery-action-message")).toHaveAttribute("data-raw-status", "calculated");
  await sellerPage.getByRole("button", { name: /Create claim|Create shipment/ }).click();
  await expect(sellerPage.getByTestId("delivery-action-message")).toHaveAttribute("data-raw-status", "created");
  await expect(sellerPage.getByTestId("seller-delivery-tracking-link")).toBeVisible();
  await sellerPage.getByRole("button", { name: "Refresh" }).click();
  await expect(sellerPage.getByTestId("delivery-action-message")).toHaveAttribute("data-raw-status", "refreshed");

  await customerPage.reload();
  await expect(customerPage.getByTestId("tracked-payment-status")).toHaveText("PAID");
  await expect(customerPage.getByTestId("tracked-delivery-status")).toBeVisible();
  await expect(customerPage.getByTestId("tracked-delivery-link")).toBeVisible();
  await expect(customerPage.getByTestId("tracked-order-status")).toBeVisible();

  await sellerContext.close();
  await customerContext.close();
});
