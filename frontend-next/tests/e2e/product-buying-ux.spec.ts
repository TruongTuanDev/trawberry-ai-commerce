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
        fullName: "Product Buying UX Seller",
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
      legalName: "Product Buying UX Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow, Product Buying UX Street 1",
      contactName: "Product Buying UX Seller",
      contactPhone: "+79990000010",
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
          buffer: Buffer.from("%PDF-1.4\n% product buying ux e2e\n"),
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

async function createProduct(request: APIRequestContext, token: string, stamp: number) {
  const shop = await backendJson<{ id: string; name: string }>(
    request,
    "/api/shops",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Cookie: "" },
      data: {
        name: `Product Buying UX Shop ${stamp}`,
        slug: `product-buying-ux-shop-${stamp}`,
        paymentInstructions: "Manual transfer for product buying UX",
      },
    },
  );
  const wbNmId = 7400000 + (stamp % 100000);
  const product = await backendJson<{
    id: string;
    variants: Array<{ id: string }>;
  }>(request, `/api/shops/${shop.id}/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    data: {
      wbNmId,
      wbTitle: `Product Buying UX Jacket ${stamp}`,
      localTitle: `Product Buying UX Jacket ${stamp}`,
      localDescription: "Wildberries-inspired public buying UX E2E product",
      categoryName: "Product Buying UX Category",
      visibility: "ACTIVE",
      variants: [
        {
          chrtId: wbNmId + 10,
          techSize: "XL",
          basePrice: 1788,
          stockQuantity: 3,
          trackInventory: true,
          isActive: true,
        },
        {
          chrtId: wbNmId + 20,
          techSize: "2XL",
          basePrice: 1825,
          stockQuantity: 0,
          trackInventory: true,
          isActive: true,
        },
      ],
    },
  });

  for (const suffix of ["front", "detail"]) {
    await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Cookie: "" },
      multipart: {
        files: {
          name: `product-buying-ux-${suffix}-${stamp}.png`,
          mimeType: "image/png",
          buffer: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=",
            "base64",
          ),
        },
      },
    });
  }

  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    data: {},
  });

  return { shop, product };
}

test("public marketplace product buying UX supports size selection, in-cart state, and buy now", async ({
  page,
  request,
}) => {
  test.setTimeout(150000);

  const stamp = Date.now();
  const seller = await approveSeller(request, `product-buying-ux-${stamp}@example.com`);
  const created = await createProduct(request, seller.token, stamp);

  await page.goto("/products");
  await expect(page.getByTestId("products-grid")).toBeVisible();
  const productCard = page.getByTestId("product-card").filter({
    hasText: `Product Buying UX Jacket ${stamp}`,
  });
  await expect(productCard).toContainText("Выбрать размер");

  await productCard.getByTestId(`product-view-${created.product.id}`).click();
  await expect(page.getByTestId("product-gallery")).toBeVisible();
  await expect(page.getByTestId("product-detail-title")).toContainText(
    `Product Buying UX Jacket ${stamp}`,
  );
  await expect(page.getByTestId("product-gallery").locator("button")).toHaveCount(2);
  await expect(page.getByTestId(`product-size-${created.product.variants[1].id}`)).toBeDisabled();

  await expect(page.getByTestId("product-selected-size")).toBeVisible();
  await page.getByTestId("product-quantity-stepper").getByLabel("Increase quantity").click();
  await page.getByTestId("product-quantity-stepper").getByLabel("Increase quantity").click();
  await expect(page.getByTestId("product-quantity-stepper-value")).toHaveText("3");

  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("add-to-cart")).toHaveText("В корзине");
  await expect(page.getByTestId("public-cart-link")).toContainText("3");

  await page.getByTestId("continue-to-checkout").click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByTestId("checkout-order-items").locator("article")).toHaveCount(1);
  await expect(page.getByTestId("checkout-order-items")).toContainText("Qty 3 x");

  const phone = `+7996${String(stamp).slice(-7)}`;
  await page.getByTestId("checkout-full-name").fill("Buying UX Customer");
  await page.getByTestId("checkout-phone").fill(phone);
  await page.getByTestId("checkout-email").fill(`buying-ux-${stamp}@example.com`);
  await page.getByTestId("checkout-address").fill("Buying UX Address");
  await page.getByTestId("checkout-submit").click();

  await expect(page.getByTestId("checkout-confirmation")).toBeVisible();

  const inventory = await backendJson<{ totalAvailableQuantity: number }>(
    request,
    `/api/shops/${created.shop.id}/products/${created.product.id}/inventory`,
    { headers: { Authorization: `Bearer ${seller.token}`, Cookie: "" } },
  );
  expect(inventory.totalAvailableQuantity).toBe(0);
});
