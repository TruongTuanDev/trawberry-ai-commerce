import path from "node:path";
import { expect, test, type APIRequestContext } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

async function backendJson<T>(
  request: APIRequestContext,
  url: string,
  options?: Parameters<APIRequestContext["fetch"]>[1],
) {
  const response = await request.fetch(`${backendBaseUrl}${url}`, options);
  if (!response.ok()) {
    throw new Error(`${options?.method ?? "GET"} ${url} failed ${response.status()}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

async function approveSeller(request: APIRequestContext, email: string, password: string) {
  const register = await backendJson<{ userId: string; approvalStatus: string }>(request, "/api/auth/register", {
    method: "POST",
    data: {
      email,
      password,
      fullName: "WB Import Checkout Seller",
      role: "SELLER",
    },
  });
  expect(register.approvalStatus).toBe("PENDING");

  const sellerLogin = await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
    method: "POST",
    data: { email, password },
  });

  await backendJson(request, "/api/seller/onboarding/profile", {
    method: "PUT",
    headers: { Authorization: `Bearer ${sellerLogin.accessToken}` },
    data: {
      legalType: "IP",
      legalName: "WB Import Checkout IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow, WB Import Street 1",
      contactName: "WB Import Checkout Seller",
      contactPhone: "+79990000011",
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
        buffer: Buffer.from("%PDF-1.4\n% wb import checkout\n"),
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

  return sellerLogin.accessToken;
}

test("seller imports Wildberries Excel, reviews and publishes it, then customer checks out", async ({
  browser,
  page,
  request,
}) => {
  test.setTimeout(150000);

  const stamp = Date.now();
  const sellerEmail = `wb-import-checkout-${stamp}@example.com`;
  const password = "password123";
  const shopName = `WB Checkout Shop ${stamp}`;
  const preferredProductName = "WB Linen Shorts";
  const fixturePath = path.resolve("../backend-nest/test/fixtures/wb-products-sample.xlsx");
  const customerPhone = `+7996${String(stamp).slice(-7)}`;

  const sellerToken = await approveSeller(request, sellerEmail, password);
  const shop = await backendJson<{ id: string }>(request, "/api/shops", {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerToken}`, Cookie: "" },
    data: {
      name: shopName,
      slug: `wb-checkout-shop-${stamp}`,
      paymentInstructions: "Manual transfer pending seller review.",
    },
  });

  await page.goto("/login");
  await page.getByTestId("login-email").fill(sellerEmail);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/seller/dashboard");

  await page.goto("/seller/import/wildberries");
  await expect(page.getByTestId("wb-import-page")).toBeVisible();
  await expect(page.getByTestId("wb-import-page").getByText(shopName)).toBeVisible();
  await page.getByTestId("wb-import-file").setInputFiles(fixturePath);
  await page.getByTestId("wb-import-default-stock").fill("0");
  await page.getByTestId("wb-import-publish-mode").selectOption("ACTIVE");
  await page.getByTestId("wb-import-price-fallback").fill("1990");
  await page.getByTestId("wb-import-preview").click();

  await expect(page.getByTestId("wb-import-summary")).toContainText("Products");
  await expect(page.getByTestId("wb-import-product-row").first()).toBeVisible();
  await page.getByTestId("wb-import-confirm").click();
  await expect(page.getByTestId("wb-import-result")).toBeVisible();

  const sellerProducts = await backendJson<{
    items: Array<{ id: string; title: string }>;
  }>(request, `/api/shops/${shop.id}/products?page=1&size=10`, {
    headers: { Authorization: `Bearer ${sellerToken}`, Cookie: "" },
  });
  const importedProduct =
    sellerProducts.items.find((item) => item.title.includes(preferredProductName)) ?? sellerProducts.items[0];
  expect(importedProduct?.id).toBeTruthy();
  if (!importedProduct) {
    throw new Error("Expected Wildberries import to create at least one product.");
  }
  const productName = importedProduct.title;

  await page.getByRole("link", { name: "View imported products" }).click();
  await page.getByPlaceholder("Search by product name, WB ID, brand or vendor code...").fill(productName);
  await page.getByRole("button", { name: "Apply filters" }).click();
  const importedRow = page.getByTestId("seller-product-row").filter({ hasText: productName });
  await expect(importedRow).toBeVisible();
  await expect(importedRow).toContainText("IMPORTED");
  await importedRow.getByRole("link", { name: "View details" }).click();

  await expect(page.getByTestId("seller-product-detail-page")).toBeVisible();
  await page.getByTestId("product-price-input").first().fill("1990");
  await page.getByTestId("product-stock-input").first().fill("5");
  await page.getByTestId("product-variant-save").first().click();
  await expect(page.getByTestId("product-price-input").first()).toHaveValue("1990");
  await expect(page.getByText("5 available")).toBeVisible();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Catalog status").locator("..")).toContainText("PUBLISHED");

  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  await customerPage.goto("/products");
  await customerPage.getByLabel("Search catalog").fill(productName);
  await customerPage.getByRole("button", { name: "Search" }).click();
  await expect(customerPage.getByTestId(`product-view-${importedProduct!.id}`)).toBeVisible();
  await customerPage.getByTestId(`product-view-${importedProduct!.id}`).click();
  await expect(customerPage.getByRole("heading", { name: productName })).toBeVisible();
  await customerPage.getByTestId("product-quantity-stepper").getByLabel("Increase quantity").click();
  await customerPage.getByTestId("continue-to-checkout").click();

  await customerPage.waitForURL(/\/checkout/);
  await customerPage.getByTestId("checkout-full-name").fill("WB Checkout Customer");
  await customerPage.getByTestId("checkout-phone").fill(customerPhone);
  await customerPage.getByTestId("checkout-email").fill(`wb-customer-${stamp}@example.com`);
  await customerPage.getByTestId("checkout-address").fill("Tverskaya Street 10, Moscow");
  await customerPage.getByTestId("checkout-note").fill(`WB import checkout ${stamp}`);
  await customerPage.getByTestId("checkout-submit").click();
  await expect(customerPage.getByTestId("checkout-confirmation")).toBeVisible();

  const confirmationText = await customerPage.getByTestId("checkout-confirmation").innerText();
  const orderCode = confirmationText.match(/ORD-\d+-\d+/)?.[0] ?? "";
  expect(orderCode).toBeTruthy();
  await customerPage.getByTestId("confirmation-track-link").click();
  await expect(customerPage.getByTestId("tracked-order-page")).toBeVisible();
  await expect(customerPage.getByText(orderCode)).toBeVisible();
  await customerContext.close();

  await page.goto("/seller/orders");
  await page.getByPlaceholder("Search by order, customer, phone, product").fill(orderCode);
  await expect(page.getByTestId("seller-order-card").filter({ hasText: orderCode })).toBeVisible();

  const inventory = await backendJson<{ totalAvailableQuantity: number }>(
    request,
    `/api/shops/${shop.id}/products/${importedProduct!.id}/inventory`,
    {
      headers: { Authorization: `Bearer ${sellerToken}`, Cookie: "" },
    },
  );
  expect(inventory.totalAvailableQuantity).toBe(3);
});
