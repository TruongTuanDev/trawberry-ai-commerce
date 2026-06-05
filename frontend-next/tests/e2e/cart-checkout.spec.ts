import { expect, test, type APIRequestContext } from "@playwright/test";

const backendBaseUrl =
  process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

async function backendJson<T>(
  request: APIRequestContext,
  url: string,
  options?: Parameters<APIRequestContext["fetch"]>[1],
) {
  let response = await request.fetch(`${backendBaseUrl}${url}`, options);
  for (let attempt = 0; response.status() === 429 && attempt < 4; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    response = await request.fetch(`${backendBaseUrl}${url}`, options);
  }
  expect(
    response.ok(),
    `${options?.method ?? "GET"} ${url} -> ${response.status()}: ${await response.text()}`,
  ).toBeTruthy();
  return (await response.json()) as T;
}

async function approveSeller(request: APIRequestContext, email: string) {
  const password = "password123";
  const register = await backendJson<{ userId: string }>(
    request,
    "/api/auth/register",
    {
      method: "POST",
      data: {
        email,
        password,
        fullName: "Cart Checkout Seller",
        role: "SELLER",
      },
    },
  );
  const sellerLogin = await backendJson<{ accessToken: string }>(
    request,
    "/api/auth/seller/login",
    {
      method: "POST",
      data: { identifier: email, password },
    },
  );
  await backendJson(request, "/api/seller/onboarding/profile", {
    method: "PUT",
    headers: { Authorization: `Bearer ${sellerLogin.accessToken}` },
    data: {
      legalType: "IP",
      legalName: "Cart Checkout Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow, Cart Checkout Street 1",
      contactName: "Cart Checkout Seller",
      contactPhone: "+79990000007",
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
          name: "seller-inn.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4\n% cart checkout e2e\n"),
        },
      },
    },
  );
  const adminLogin = await backendJson<{ accessToken: string }>(
    request,
    "/api/auth/admin/login",
    {
      method: "POST",
      data: {
        identifier: "demo-admin@trawberry.local",
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

async function createTwoVariantProduct(
  request: APIRequestContext,
  input: {
    token: string;
    stamp: number;
  },
) {
  const shop = await backendJson<{ id: string; name: string }>(
    request,
    "/api/shops",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${input.token}`, Cookie: "" },
      data: {
        name: `E2E Cart Shop ${input.stamp}`,
        slug: `e2e-cart-shop-${input.stamp}`,
        paymentInstructions: "Manual transfer for cart checkout",
      },
    },
  );
  await backendJson(request, `/api/shops/${shop.id}/payment-settings`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${input.token}`, Cookie: "" },
    data: {
      paymentMode: "STATIC_QR",
      status: "READY",
      bankName: "T-Bank",
      recipientName: "Cart Checkout Seller",
      recipientPhone: "+79990000007",
      recipientAccount: "40817810000000000707",
      sbpPhone: "+79990000007",
      paymentInstruction: "Pay seller directly by QR.",
      allowPrepaidQr: true,
      allowPayOnDeliverySellerQr: true,
      allowDepositPayment: true,
      depositPercent: 30,
    },
  });
  const wbNmId = 7100000 + (input.stamp % 100000);
  const product = await backendJson<{
    id: string;
    variants: Array<{ id: string }>;
  }>(request, `/api/shops/${shop.id}/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.token}`, Cookie: "" },
    data: {
      wbNmId,
      wbTitle: `E2E Cart Product ${input.stamp}`,
      localTitle: `E2E Cart Product ${input.stamp}`,
      localDescription: "E2E cart product with two variants",
      categoryName: "Cart Checkout Category",
      visibility: "ACTIVE",
      variants: [
        {
          chrtId: wbNmId + 10,
          techSize: "S",
          basePrice: 120,
          stockQuantity: 8,
          trackInventory: true,
          isActive: true,
        },
        {
          chrtId: wbNmId + 20,
          techSize: "M",
          basePrice: 144,
          stockQuantity: 6,
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
        name: `cart-product-${input.stamp}.png`,
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
    headers: { Authorization: `Bearer ${input.token}`, Cookie: "" },
    data: {},
  });

  return { shop, product };
}

test("customer can cart checkout multiple items and track them", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);

  const stamp = Date.now();
  const seller = await approveSeller(request, `cart-checkout-${stamp}@example.com`);
  const created = await createTwoVariantProduct(request, {
    token: seller.token,
    stamp,
  });

  await page.goto(`/products/${created.product.id}`);
  await expect(
    page.getByRole("heading", { name: `E2E Cart Product ${stamp}` }),
  ).toBeVisible();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("public-cart-count")).toHaveText("1");
  await expect(page.getByTestId("continue-to-checkout")).toBeVisible();

  await page.getByTestId(`product-size-${created.product.variants[1].id}`).click();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("public-cart-count")).toHaveText("2");

  await page.goto("/cart");
  await expect(page.getByTestId("cart-items")).toBeVisible();
  await page.getByTestId("cart-quantity-input").first().fill("2");
  await page.getByTestId("cart-checkout").click();

  await page.getByTestId("checkout-full-name").fill("Cart E2E Customer");
  const phone = `+7997${Date.now().toString().slice(-7)}`;
  await page.getByTestId("checkout-phone").fill(phone);
  await page.getByTestId("checkout-email").fill("cart-e2e@example.com");
  await page.getByTestId("checkout-address").fill("Cart E2E Address");
  await page.getByTestId("checkout-note").fill("Cart checkout E2E");
  await expect(
    page.getByTestId("checkout-order-items").locator("article"),
  ).toHaveCount(2);
  await page.getByTestId("checkout-submit").click();

  await expect(page.getByTestId("checkout-confirmation")).toBeVisible();
  const confirmationText = await page
    .getByTestId("checkout-confirmation")
    .innerText();
  const orderId =
    confirmationText.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    )?.[0] ?? "";
  expect(orderId).toBeTruthy();

  await page.getByTestId("confirmation-track-link").click();
  await expect(page.getByTestId("tracked-order-page")).toBeVisible();
  await expect(page.getByTestId("tracked-order-item")).toHaveCount(2);
});
