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
      legalAddress: "Moscow, Multi Shop Street 1",
      contactName: fullName,
      contactPhone: "+79990000006",
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
          buffer: Buffer.from("%PDF-1.4\n% multi shop checkout e2e\n"),
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
        localDescription: `${input.productName} description`,
        categoryName: "Multi Shop Category",
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
  });

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
  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.token}`, Cookie: "" },
    data: {},
  });

  return { shop, product };
}

test("customer checks out products from two shops into split orders", async ({
  browser,
  page,
  request,
}) => {
  test.setTimeout(150000);

  const stamp = Date.now();
  const sellerAEmail = `multi-shop-a-${stamp}@example.com`;
  const sellerBEmail = `multi-shop-b-${stamp}@example.com`;
  const sellerA = await approveSeller(request, sellerAEmail, "Multi Shop Seller A");
  const sellerB = await approveSeller(request, sellerBEmail, "Multi Shop Seller B");
  const productA = await createPublicProduct(request, {
    token: sellerA.token,
    shopName: `E2E Multi Shop A ${stamp}`,
    shopSlug: `e2e-multi-shop-a-${stamp}`,
    productName: `E2E Multi Shop Product A ${stamp}`,
    price: 100,
    stock: 10,
    wbNmId: 8100000 + (stamp % 100000),
  });
  const productB = await createPublicProduct(request, {
    token: sellerB.token,
    shopName: `E2E Multi Shop B ${stamp}`,
    shopSlug: `e2e-multi-shop-b-${stamp}`,
    productName: `E2E Multi Shop Product B ${stamp}`,
    price: 200,
    stock: 7,
    wbNmId: 9100000 + (stamp % 100000),
  });

  await page.goto(`/products/${productA.product.id}`);
  await page.getByTestId("product-quantity-stepper").getByLabel("Increase quantity").click();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("add-to-cart")).toHaveText("В корзине");

  await page.goto(`/products/${productB.product.id}`);
  await page.getByTestId("product-quantity-stepper").getByLabel("Increase quantity").click();
  await page.getByTestId("product-quantity-stepper").getByLabel("Increase quantity").click();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("add-to-cart")).toHaveText("В корзине");

  await page.goto("/cart");
  await expect(page.getByTestId("cart-shop-group")).toHaveCount(2);
  await expect(page.getByTestId("cart-shop-group").filter({ hasText: productA.shop.name })).toBeVisible();
  await expect(page.getByTestId("cart-shop-group").filter({ hasText: productB.shop.name })).toBeVisible();
  await page.getByTestId("cart-checkout").click();

  const phone = `+7995${String(stamp).slice(-7)}`;
  await page.getByTestId("checkout-full-name").fill("Multi Shop Customer");
  await page.getByTestId("checkout-phone").fill(phone);
  await page.getByTestId("checkout-email").fill(`multi-shop-customer-${stamp}@example.com`);
  await page.getByTestId("checkout-address").fill("Multi Shop Address");
  await expect(page.getByTestId("checkout-shop-group")).toHaveCount(2);
  await page.getByTestId("checkout-submit").click();

  await expect(page.getByTestId("checkout-confirmation")).toBeVisible();
  await expect(page.getByTestId("checkout-order-card")).toHaveCount(2);
  const confirmationText = await page.getByTestId("checkout-confirmation").innerText();
  const orderCodes = [...new Set(confirmationText.match(/ORD-\d+-\d+/g) ?? [])];
  expect(orderCodes).toHaveLength(2);
  const orderACard = page.getByTestId("checkout-order-card").filter({ hasText: productA.shop.name });
  const orderBCard = page.getByTestId("checkout-order-card").filter({ hasText: productB.shop.name });
  await expect(orderACard).toBeVisible();
  await expect(orderBCard).toBeVisible();
  const orderACode = (await orderACard.innerText()).match(/ORD-\d+-\d+/)?.[0];
  const orderBCode = (await orderBCard.innerText()).match(/ORD-\d+-\d+/)?.[0];
  expect(orderACode).toBeTruthy();
  expect(orderBCode).toBeTruthy();
  expect(orderACode).not.toBe(orderBCode);

  for (const link of await page.getByTestId(/confirmation-track-link/).all()) {
    const href = await link.getAttribute("href");
    expect(href).toContain("/orders/");
  }

  const trackContext = await browser.newContext();
  const trackPage = await trackContext.newPage();
  for (const code of orderCodes) {
    await trackPage.goto("/orders/track");
    await trackPage.getByTestId("track-order-code").fill(code);
    await trackPage.getByTestId("track-order-phone").fill(phone);
    await trackPage.getByTestId("track-order-submit").click();
    await expect(trackPage.getByText(code)).toBeVisible();
  }
  await trackContext.close();

  const sellerAContext = await browser.newContext();
  const sellerAPage = await sellerAContext.newPage();
  await sellerAPage.goto("/login");
  await sellerAPage.getByTestId("login-email").fill(sellerAEmail);
  await sellerAPage.getByTestId("login-password").fill(sellerA.password);
  await sellerAPage.getByTestId("login-submit").click();
  await sellerAPage.waitForURL("**/seller/dashboard");
  await sellerAPage.goto("/seller/orders");
  await sellerAPage.getByPlaceholder("Search by order, customer, phone, product").fill(orderACode!);
  await expect(sellerAPage.getByTestId("seller-order-card").filter({ hasText: orderACode! })).toBeVisible();
  await sellerAPage.getByPlaceholder("Search by order, customer, phone, product").fill(orderBCode!);
  await expect(sellerAPage.getByTestId("seller-order-card").filter({ hasText: orderBCode! })).toHaveCount(0);
  await sellerAContext.close();

  const sellerBContext = await browser.newContext();
  const sellerBPage = await sellerBContext.newPage();
  await sellerBPage.goto("/login");
  await sellerBPage.getByTestId("login-email").fill(sellerBEmail);
  await sellerBPage.getByTestId("login-password").fill(sellerB.password);
  await sellerBPage.getByTestId("login-submit").click();
  await sellerBPage.waitForURL("**/seller/dashboard");
  await sellerBPage.goto("/seller/orders");
  await sellerBPage.getByPlaceholder("Search by order, customer, phone, product").fill(orderBCode!);
  await expect(sellerBPage.getByTestId("seller-order-card").filter({ hasText: orderBCode! })).toBeVisible();
  await sellerBPage.getByPlaceholder("Search by order, customer, phone, product").fill(orderACode!);
  await expect(sellerBPage.getByTestId("seller-order-card").filter({ hasText: orderACode! })).toHaveCount(0);
  await sellerBContext.close();

  const inventoryA = await backendJson<{ totalAvailableQuantity: number }>(
    request,
    `/api/shops/${productA.shop.id}/products/${productA.product.id}/inventory`,
    { headers: { Authorization: `Bearer ${sellerA.token}`, Cookie: "" } },
  );
  const inventoryB = await backendJson<{ totalAvailableQuantity: number }>(
    request,
    `/api/shops/${productB.shop.id}/products/${productB.product.id}/inventory`,
    { headers: { Authorization: `Bearer ${sellerB.token}`, Cookie: "" } },
  );
  expect(inventoryA.totalAvailableQuantity).toBe(8);
  expect(inventoryB.totalAvailableQuantity).toBe(4);
});
