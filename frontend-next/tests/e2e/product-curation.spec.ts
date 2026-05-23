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
      fullName: "Product Curation Seller",
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
      legalName: "Product Curation Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow, Product Curation Street 1",
      contactName: "Product Curation Seller",
      contactPhone: "+79990000012",
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
        buffer: Buffer.from("%PDF-1.4\n% product curation\n"),
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

test("seller curates imported Wildberries products before they appear in public marketplace", async ({
  page,
  request,
}) => {
  test.setTimeout(150000);

  const stamp = Date.now();
  const sellerEmail = `product-curation-${stamp}@example.com`;
  const password = "password123";
  const shopName = `Product Curation Shop ${stamp}`;
  const fixturePath = path.resolve("../backend-nest/test/fixtures/wb-products-sample.xlsx");

  const sellerToken = await approveSeller(request, sellerEmail, password);
  const shop = await backendJson<{ id: string }>(request, "/api/shops", {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerToken}`, Cookie: "" },
    data: {
      name: shopName,
      slug: `product-curation-shop-${stamp}`,
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
  await page.getByTestId("wb-import-price-fallback").fill("1990");
  await page.getByTestId("wb-import-preview").click();
  await expect(page.getByTestId("wb-import-summary")).toContainText("Products");
  await page.getByTestId("wb-import-confirm").click();
  await expect(page.getByTestId("wb-import-result")).toBeVisible();

  const sellerProducts = await backendJson<{
    items: Array<{ id: string; title: string }>;
  }>(request, `/api/shops/${shop.id}/products?page=1&size=10`, {
    headers: { Authorization: `Bearer ${sellerToken}`, Cookie: "" },
  });
  const importedProduct = sellerProducts.items[0];
  expect(importedProduct?.id).toBeTruthy();
  if (!importedProduct) {
    throw new Error("Expected imported products in seller catalog.");
  }

  const notFoundBeforePublish = await request.get(`${backendBaseUrl}/api/public/products/${importedProduct.id}`);
  expect(notFoundBeforePublish.status()).toBe(404);

  await page.getByRole("link", { name: "View imported products" }).click();
  await page.getByPlaceholder("Search by product name, WB ID, brand or vendor code...").fill(importedProduct.title);
  await page.getByRole("button", { name: "Apply filters" }).click();
  const importedRow = page.getByTestId("seller-product-row").filter({ hasText: importedProduct.title });
  await expect(importedRow).toBeVisible();
  await expect(importedRow).toContainText("WILDBERRIES_EXCEL");
  await importedRow.click();

  await expect(page.getByTestId("seller-product-detail-page")).toBeVisible();
  await page.getByTestId("product-price-input").first().fill("1990");
  await page.getByTestId("product-stock-input").first().fill("5");
  await page.getByTestId("product-variant-save").first().click();
  await expect(page.getByText("5 available")).toBeVisible();

  const publicDetail = await backendJson<{ id: string }>(request, `/api/public/products/${importedProduct.id}`);
  expect(publicDetail.id).toBe(importedProduct.id);

  await page.goto("/products");
  await page.getByLabel("Search catalog").fill(importedProduct.title);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByTestId(`product-view-${importedProduct.id}`)).toBeVisible();

  await page.goto(`/seller/products/${importedProduct.id}`);
  await page.getByTestId("product-stock-input").first().fill("0");
  await page.getByTestId("product-variant-save").first().click();
  await expect(page.getByText("0 available")).toBeVisible();

  const notFoundAfterUnpublish = await request.get(`${backendBaseUrl}/api/public/products/${importedProduct.id}`);
  expect(notFoundAfterUnpublish.status()).toBe(404);

  await page.goto("/products");
  await page.getByLabel("Search catalog").fill(importedProduct.title);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByTestId(`product-view-${importedProduct.id}`)).toHaveCount(0);
});
