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
        fullName: "Cart Validation Seller",
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
      legalName: "Cart Validation Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow, Cart Validation Street 1",
      contactName: "Cart Validation Seller",
      contactPhone: "+79990000013",
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
          buffer: Buffer.from("%PDF-1.4\n% cart validation e2e\n"),
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

  return { token: sellerLogin.accessToken };
}

async function createPublishedProduct(
  request: APIRequestContext,
  token: string,
  stamp: number,
) {
  const shop = await backendJson<{ id: string; name: string }>(
    request,
    "/api/shops",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Cookie: "" },
      data: {
        name: `Cart Validation Shop ${stamp}`,
        slug: `cart-validation-shop-${stamp}`,
        paymentInstructions: "Manual transfer for cart validation",
      },
    },
  );

  const wbNmId = 7900000 + (stamp % 100000);
  const product = await backendJson<{
    id: string;
    variants: Array<{ id: string }>;
  }>(request, `/api/shops/${shop.id}/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    data: {
      wbNmId,
      wbTitle: `Cart Validation Jacket ${stamp}`,
      localTitle: `Cart Validation Jacket ${stamp}`,
      localDescription: "Cart validation stale item product",
      categoryName: "Cart Validation Category",
      visibility: "ACTIVE",
      variants: [
        {
          chrtId: wbNmId + 10,
          techSize: "XL",
          basePrice: 1499,
          stockQuantity: 2,
          trackInventory: true,
          isActive: true,
        },
      ],
    },
  });

  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    multipart: {
      files: {
        name: `cart-validation-${stamp}.png`,
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

test.describe("cart validation stale cart preflight", () => {
  test("cart page and checkout preflight catch stale items before submit", async ({
    page,
    request,
  }) => {
    test.setTimeout(180000);

    const stamp = Date.now();
    const seller = await approveSeller(
      request,
      `cart-validation-${stamp}@example.com`,
    );
    const created = await createPublishedProduct(request, seller.token, stamp);
    const variantId = created.product.variants[0]?.id ?? "";

    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.goto(`/products/${created.product.id}`);
    await page
      .getByTestId("product-quantity-stepper")
      .getByLabel("Increase quantity")
      .click();
    await page.getByTestId("add-to-cart").click();

    await page.goto("/cart");
    await expect(page.getByTestId("cart-items")).toBeVisible();
    await expect(page.getByTestId("cart-checkout")).toBeEnabled();

    await backendJson(
      request,
      `/api/shops/${created.shop.id}/products/${created.product.id}/inventory`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${seller.token}`, Cookie: "" },
        data: {
          variantId,
          stockQuantity: 1,
        },
      },
    );

    await page.reload();
    await expect(
      page.getByTestId(
        `cart-item-validation-${created.product.id}-${variantId}`,
      ),
    ).toContainText("Only 1 left");
    await expect(
      page.getByTestId(
        `cart-validation-set-max-${created.product.id}-${variantId}`,
      ),
    ).toBeVisible();
    await expect(page.getByTestId("cart-checkout")).toBeDisabled();

    await page
      .getByTestId(`cart-validation-set-max-${created.product.id}-${variantId}`)
      .click();
    await expect(page.getByTestId("cart-quantity-input").first()).toHaveValue("1");
    await expect(page.getByTestId("cart-checkout")).toBeEnabled();

    await page.getByTestId("cart-checkout").click();
    await page.getByTestId("checkout-full-name").fill("Cart Validation Customer");
    await page.getByTestId("checkout-phone").fill("+79991234567");
    await page.getByTestId("checkout-address").fill("123 Cart Validation Street");

    await backendJson(
      request,
      `/api/shops/${created.shop.id}/products/${created.product.id}/unpublish`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${seller.token}`, Cookie: "" },
        data: {},
      },
    );

    await page.getByTestId("checkout-submit").click();
    await expect(page.getByTestId("checkout-validation-panel")).toBeVisible();
    await expect(page.getByTestId("checkout-validation-panel")).toContainText(
      "no longer public",
    );
    await page.getByTestId("checkout-validation-back-to-cart").click();

    await expect(
      page.getByTestId(
        `cart-item-validation-${created.product.id}-${variantId}`,
      ),
    ).toContainText("no longer public");
    await expect(page.getByTestId("cart-checkout")).toBeDisabled();

    await page
      .getByTestId(`cart-validation-remove-${created.product.id}-${variantId}`)
      .click();
    await expect(page.getByTestId("cart-empty-state")).toBeVisible();
  });
});
