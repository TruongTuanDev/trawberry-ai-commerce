import { expect, test, type APIRequestContext } from "@playwright/test";

const backendBaseUrl =
  process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

const pngBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=",
  "base64",
);

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

async function approveSeller(
  request: APIRequestContext,
  email: string,
  fullName: string,
) {
  const password = "password123";
  const register = await backendJson<{ userId: string }>(
    request,
    "/api/auth/register",
    {
      method: "POST",
      data: {
        email,
        password,
        fullName,
        role: "SELLER",
      },
    },
  );
  const sellerLogin = await backendJson<{ accessToken: string }>(
    request,
    "/api/auth/login",
    {
      method: "POST",
      data: { email, password },
    },
  );
  await backendJson(request, "/api/seller/onboarding/profile", {
    method: "PUT",
    headers: { Authorization: `Bearer ${sellerLogin.accessToken}` },
    data: {
      legalType: "IP",
      legalName: `${fullName} IP`,
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow, Payment Review Street 1",
      contactName: fullName,
      contactPhone: "+79990000009",
      contactEmail: email,
    },
  });
  const document = await backendJson<{ id: string }>(
    request,
    "/api/seller/onboarding/documents",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${sellerLogin.accessToken}` },
      multipart: {
        documentType: "INN",
        file: {
          name: "seller-payment-review.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4\n% public payment review e2e\n"),
        },
      },
    },
  );
  const adminLogin = await backendJson<{ accessToken: string }>(
    request,
    "/api/auth/login",
    {
      method: "POST",
      data: {
        email: "demo-admin@trawberry.local",
        password: "DemoAdmin123!",
      },
    },
  );
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
  return { token: sellerLogin.accessToken, password };
}

async function createPublishedProduct(
  request: APIRequestContext,
  input: {
    token: string;
    shopName: string;
    shopSlug: string;
    productName: string;
    wbNmId: number;
  },
) {
  const shop = await backendJson<{ id: string; name: string }>(
    request,
    "/api/shops",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${input.token}`, Cookie: "" },
      data: {
        name: input.shopName,
        slug: input.shopSlug,
        paymentInstructions: `Manual transfer for ${input.shopName}`,
      },
    },
  );

  const product = await backendJson<{
    id: string;
    variants: Array<{ id: string }>;
  }>(request, `/api/shops/${shop.id}/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.token}`, Cookie: "" },
    data: {
      wbNmId: input.wbNmId,
      wbTitle: input.productName,
      localTitle: input.productName,
      localDescription: `${input.productName} payment review product`,
      categoryName: "Payment Review Category",
      visibility: "ACTIVE",
      variants: [
        {
          chrtId: input.wbNmId + 10,
          techSize: "Default",
          basePrice: 125,
          stockQuantity: 10,
          trackInventory: true,
          isActive: true,
        },
      ],
    },
  });

  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.token}`, Cookie: "" },
    multipart: {
      files: {
        name: "payment-review-product.png",
        mimeType: "image/png",
        buffer: pngBuffer,
      },
    },
  });

  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.token}`, Cookie: "" },
    data: {},
  });

  return { shop, product };
}

test("customer uploads proof, seller marks paid, customer sees paid status", async ({ browser, request }) => {
  test.setTimeout(120000);

  const stamp = Date.now();
  const sellerEmail = `payment-review-${stamp}@example.com`;
  const seller = await approveSeller(request, sellerEmail, "Payment Review Seller");
  const created = await createPublishedProduct(request, {
    token: seller.token,
    shopName: `Payment Review Shop ${stamp}`,
    shopSlug: `payment-review-shop-${stamp}`,
    productName: `Payment Review Product ${stamp}`,
    wbNmId: 8600000 + (stamp % 100000),
  });

  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  const phone = `+7999${Date.now().toString().slice(-7)}`;

  await customerPage.goto(`/products/${created.product.id}`);
  await customerPage.getByTestId("continue-to-checkout").click();

  await customerPage.waitForURL(/\/checkout/);
  await customerPage.getByTestId("checkout-full-name").fill("Demo Customer");
  await customerPage.getByTestId("checkout-phone").fill(phone);
  await customerPage.getByTestId("checkout-email").fill("demo-customer@example.com");
  await customerPage.getByTestId("checkout-address").fill("Demo Address");
  await customerPage.getByTestId("checkout-note").fill(`Payment review E2E ${phone}`);
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

  await customerPage.goto("/orders/track");
  await customerPage.getByTestId("track-order-code").fill(orderCode);
  await customerPage.getByTestId("track-order-phone").fill(phone);
  await customerPage.getByTestId("track-order-submit").click();

  await expect(customerPage).toHaveURL(new RegExp(`/orders/${orderId}\\?phone=`));
  await expect(customerPage.getByTestId("tracked-order-page")).toBeVisible();
  await expect(customerPage.getByTestId("tracked-payment-status")).toHaveAttribute("data-status", "PENDING");

  await customerPage.getByTestId("payment-proof-input").setInputFiles({
    name: "payment-proof.png",
    mimeType: "image/png",
    buffer: pngBuffer,
  });
  await customerPage.getByTestId("payment-proof-submit").click();

  await expect(customerPage.getByTestId("tracked-payment-proof-link")).toBeVisible();
  await expect(customerPage.getByText("BUYER_MARKED_PAID")).toBeVisible();

  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();

  await sellerPage.goto("/login");
  await expect(sellerPage.getByTestId("login-form")).toBeVisible();
  await sellerPage.getByTestId("login-email").fill(sellerEmail);
  await sellerPage.getByTestId("login-password").fill(seller.password);
  await sellerPage.getByTestId("login-submit").click();

  await sellerPage.waitForURL("**/seller/dashboard");
  await sellerPage.goto(`/seller/payments/${orderId}`);
  await expect(sellerPage.getByTestId("seller-payment-detail-page")).toBeVisible();
  await expect(sellerPage.getByText(orderCode)).toBeVisible();
  await expect(sellerPage.getByTestId("seller-payment-proof-link")).toBeVisible();
  await expect(sellerPage.getByTestId("seller-payment-status")).toHaveAttribute("data-status", "PENDING");

  sellerPage.once("dialog", (dialog) => dialog.accept());
  await sellerPage.getByTestId("seller-mark-paid-button").click();

  await expect(sellerPage.getByTestId("seller-payment-status")).toHaveAttribute("data-status", "PAID");
  await expect(sellerPage.locator("span").filter({ hasText: "SELLER_CONFIRMED" }).first()).toBeVisible();
  await sellerPage.goto("/seller/orders");
  await sellerPage.getByTestId("seller-order-tab-NEW").click();
  await expect(
    sellerPage.getByTestId("seller-order-card").filter({ hasText: orderCode }),
  ).toBeVisible();

  await customerPage.reload();
  await expect(customerPage.getByTestId("tracked-order-page")).toBeVisible();
  await expect(customerPage.getByTestId("tracked-payment-status")).toHaveAttribute("data-status", "PAID");

  await sellerContext.close();
  await customerContext.close();
});
