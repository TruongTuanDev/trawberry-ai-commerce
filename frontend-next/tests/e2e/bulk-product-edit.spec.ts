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
      fullName: "Bulk Product Edit Seller",
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
      legalName: "Bulk Product Edit Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow, Bulk Product Edit Street 1",
      contactName: "Bulk Product Edit Seller",
      contactPhone: "+79990000013",
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
        buffer: Buffer.from("%PDF-1.4\n% bulk product edit\n"),
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

test("seller bulk edits imported products before publishing them", async ({
  page,
  request,
}) => {
  test.setTimeout(180000);

  const stamp = Date.now();
  const sellerEmail = `bulk-product-edit-${stamp}@example.com`;
  const password = "password123";
  const shopName = `Bulk Product Edit Shop ${stamp}`;
  const fixturePath = path.resolve("../backend-nest/test/fixtures/wb-products-sample.xlsx");

  const sellerToken = await approveSeller(request, sellerEmail, password);
  const shop = await backendJson<{ id: string }>(request, "/api/shops", {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerToken}`, Cookie: "" },
    data: {
      name: shopName,
      slug: `bulk-product-edit-shop-${stamp}`,
      paymentInstructions: "Manual transfer pending seller review.",
    },
  });

  await page.goto("/login");
  await page.getByTestId("login-email").fill(sellerEmail);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/seller/dashboard");

  await page.goto("/seller/import/wildberries");
  await page.getByTestId("wb-import-file").setInputFiles(fixturePath);
  await page.getByTestId("wb-import-default-stock").fill("0");
  await page.getByTestId("wb-import-price-fallback").fill("0");
  await page.getByTestId("wb-import-preview").click();
  await expect(page.getByTestId("wb-import-summary")).toContainText("Products");
  await page.getByTestId("wb-import-confirm").click();
  await expect(page.getByTestId("wb-import-result")).toBeVisible();

  await page.goto("/seller/products");
  await expect(page.getByTestId("seller-products-page")).toBeVisible();

  const importedRows = page.getByTestId("seller-product-row");
  await expect(importedRows.first()).toBeVisible();
  const importedCount = await importedRows.count();
  expect(importedCount).toBeGreaterThan(0);

  for (let index = 0; index < Math.min(importedCount, 2); index += 1) {
    await importedRows.nth(index).locator('input[type="checkbox"]').check();
  }

  await expect(page.getByTestId("bulk-edit-toolbar")).toContainText("2 selected");

  await page.getByTestId("bulk-open-category").click();
  await page.getByTestId("bulk-category-select").selectOption({ index: 1 });
  await page.getByTestId("bulk-apply-submit").click();
  await expect(page.getByTestId("bulk-edit-result")).toContainText("Updated");

  await page.getByTestId("bulk-open-price").click();
  await page.getByTestId("bulk-price-input").fill("1990");
  await page.getByTestId("bulk-variant-mode").selectOption("ALL_VARIANTS");
  await page.getByTestId("bulk-apply-submit").click();
  await expect(page.getByTestId("bulk-edit-result")).toContainText("MISSING_STOCK");

  await page.getByTestId("bulk-open-stock").click();
  await page.getByTestId("bulk-stock-input").fill("5");
  await page.getByTestId("bulk-publish-if-ready").check();
  await page.getByTestId("bulk-apply-submit").click();
  await expect(page.getByTestId("bulk-edit-result")).toContainText("PUBLISHED");

  const sellerProducts = await backendJson<{
    items: Array<{ id: string; title: string; catalogStatus: string }>;
  }>(request, `/api/shops/${shop.id}/products?page=1&size=10&published=true`, {
    headers: { Authorization: `Bearer ${sellerToken}`, Cookie: "" },
  });
  expect(sellerProducts.items.length).toBeGreaterThan(0);
  const publishedProduct = sellerProducts.items[0];

  const publicDetail = await backendJson<{ id: string }>(request, `/api/public/products/${publishedProduct.id}`);
  expect(publicDetail.id).toBe(publishedProduct.id);

  await page.goto("/products");
  await page.getByLabel("Search catalog").fill(publishedProduct.title);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByTestId(`product-view-${publishedProduct.id}`)).toBeVisible();

  const checkout = await backendJson<{ orderId: string; orderCode: string }>(request, "/api/checkout/orders", {
    method: "POST",
    data: {
      shopId: shop.id,
      items: [{ productId: publishedProduct.id, quantity: 1 }],
      customer: {
        fullName: "Bulk Product Edit Customer",
        phone: `+7998${String(stamp).slice(-7)}`,
        email: `bulk-edit-customer-${stamp}@example.com`,
        address: "Bulk Product Edit Street 1",
        note: "Bulk edit e2e checkout",
      },
      paymentMethod: "MANUAL_TRANSFER",
    },
  });
  expect(checkout.orderId).toBeTruthy();
});
