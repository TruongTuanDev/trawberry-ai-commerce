import { expect, test, type APIRequestContext } from "@playwright/test";

const backendBaseUrl =
  process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

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

async function approveSeller(request: APIRequestContext, email: string, fullName: string) {
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
      legalAddress: "Moscow, Customer Orders Street 1",
      contactName: fullName,
      contactPhone: "+79990000008",
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
        buffer: Buffer.from("%PDF-1.4\n% customer order history e2e\n"),
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
  return { token: sellerLogin.accessToken };
}

async function createPublicProduct(
  request: APIRequestContext,
  input: {
    token: string;
    shopName: string;
    shopSlug: string;
    productName: string;
    price: number;
    stock: number;
    wbNmId: number;
  },
) {
  const shop = await backendJson<{ id: string; name: string }>(request, "/api/shops", {
    method: "POST",
    headers: { Authorization: `Bearer ${input.token}`, Cookie: "" },
    data: {
      name: input.shopName,
      slug: input.shopSlug,
      paymentInstructions: `Manual transfer for ${input.shopName}`,
    },
  });
  const product = await backendJson<{ id: string; variants: Array<{ id: string }> }>(
    request,
    `/api/shops/${shop.id}/products`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${input.token}`, Cookie: "" },
      data: {
        wbNmId: input.wbNmId,
        wbTitle: input.productName,
        localTitle: input.productName,
        localDescription: `${input.productName} description`,
        visibility: "ACTIVE",
        variants: [
          {
            chrtId: input.wbNmId + 10,
            techSize: "Default",
            basePrice: input.price,
            stockQuantity: input.stock,
            trackInventory: true,
            isActive: true,
          },
        ],
      },
    },
  );
  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.token}`, Cookie: "" },
    multipart: {
      files: {
        name: `${input.productName}.png`,
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=",
          "base64",
        ),
      },
    },
  });
  return { shop, product };
}

test("customer sees parent receipt and order history for multi-shop checkout", async ({ page, request }) => {
  test.setTimeout(180000);

  const stamp = Date.now();
  const sellerA = await approveSeller(request, `history-seller-a-${stamp}@example.com`, "History Seller A");
  const sellerB = await approveSeller(request, `history-seller-b-${stamp}@example.com`, "History Seller B");
  const productA = await createPublicProduct(request, {
    token: sellerA.token,
    shopName: `History Shop A ${stamp}`,
    shopSlug: `history-shop-a-${stamp}`,
    productName: `History Product A ${stamp}`,
    price: 100,
    stock: 10,
    wbNmId: 8200000 + (stamp % 100000),
  });
  const productB = await createPublicProduct(request, {
    token: sellerB.token,
    shopName: `History Shop B ${stamp}`,
    shopSlug: `history-shop-b-${stamp}`,
    productName: `History Product B ${stamp}`,
    price: 200,
    stock: 7,
    wbNmId: 9200000 + (stamp % 100000),
  });

  const customerEmail = `history-customer-${stamp}@example.com`;
  const password = "password123";
  await page.goto("/customer/register");
  await page.getByTestId("customer-register-name").fill("History Customer");
  await page.getByTestId("customer-register-email").fill(customerEmail);
  await page.getByTestId("customer-register-password").fill(password);
  await page.getByTestId("customer-register-submit").click();
  await page.waitForURL("**/customer/orders");

  await page.goto(`/products/${productA.product.id}`);
  await page.getByTestId("product-quantity-input").fill("2");
  await page.getByTestId("add-to-cart").click();
  await page.goto(`/products/${productB.product.id}`);
  await page.getByTestId("product-quantity-input").fill("3");
  await page.getByTestId("add-to-cart").click();

  await page.goto("/cart");
  await expect(page.getByTestId("cart-shop-group")).toHaveCount(2);
  await page.getByTestId("cart-checkout").click();

  const phone = `+7998${String(stamp).slice(-7)}`;
  await expect(page.getByTestId("checkout-email")).toHaveValue(customerEmail);
  await page.getByTestId("checkout-phone").fill(phone);
  await page.getByTestId("checkout-address").fill("Customer History Address");
  await page.getByTestId("checkout-submit").click();

  await expect(page.getByTestId("checkout-confirmation")).toBeVisible();
  const checkoutCode = (await page.getByTestId("checkout-confirmation").innerText()).match(/CHK-\d+-\d+/)?.[0];
  expect(checkoutCode).toBeTruthy();
  await expect(page.getByTestId("checkout-order-card")).toHaveCount(2);
  await page.getByTestId("checkout-receipt-link").click();

  await expect(page.getByTestId("checkout-receipt")).toBeVisible();
  await expect(page.getByTestId("receipt-checkout-code")).toHaveText(checkoutCode!);
  await expect(page.getByTestId("receipt-order-card")).toHaveCount(2);

  await page.goto("/customer/orders");
  await expect(page.getByTestId("customer-order-card").filter({ hasText: checkoutCode! })).toBeVisible();
  await page.goto(`/customer/orders/${checkoutCode}`);
  await expect(page.getByTestId("checkout-receipt")).toBeVisible();
  await expect(page.getByTestId("receipt-order-card")).toHaveCount(2);
  await expect(page.getByText(`History Product A ${stamp}`)).toBeVisible();
  await expect(page.getByText(`History Product B ${stamp}`)).toBeVisible();

  await page.getByTestId("receipt-track-link").first().click();
  await expect(page.getByTestId("tracked-order-page")).toBeVisible();
});
