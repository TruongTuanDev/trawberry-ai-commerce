import fs from "fs";
import path from "path";
import { expect, test, type APIRequestContext } from "@playwright/test";

const ruDict = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../src/i18n/dictionaries/ru.json"), "utf-8")
);

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

async function approveSellerForUiLifecycle(request: APIRequestContext, email: string, password: string) {
  const registerResponse = await request.post(`${backendBaseUrl}/api/auth/register`, {
    data: {
      email,
      password,
      fullName: "Seller Product Lifecycle",
      role: "SELLER",
    },
  });
  expect(registerResponse.status()).toBe(201);
  const seller = (await registerResponse.json()) as { userId: string; approvalStatus: string };
  expect(seller.approvalStatus).toBe("PENDING");

  const sellerLoginResponse = await request.post(`${backendBaseUrl}/api/auth/login`, {
    data: { email, password },
  });
  expect(sellerLoginResponse.ok()).toBeTruthy();
  const sellerLogin = (await sellerLoginResponse.json()) as { accessToken: string };

  const profileResponse = await request.put(`${backendBaseUrl}/api/seller/onboarding/profile`, {
    headers: { Authorization: `Bearer ${sellerLogin.accessToken}` },
    data: {
      legalType: "IP",
      legalName: "Seller Product Lifecycle IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow, Lifecycle Street 1",
      contactName: "Seller Product Lifecycle",
      contactPhone: "+79990000005",
      contactEmail: email,
    },
  });
  expect(profileResponse.ok()).toBeTruthy();

  const uploadResponse = await request.post(`${backendBaseUrl}/api/seller/onboarding/documents`, {
    headers: { Authorization: `Bearer ${sellerLogin.accessToken}` },
    multipart: {
      documentType: "INN",
      file: {
        name: "seller-inn.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n% seller product lifecycle\n"),
      },
    },
  });
  expect(uploadResponse.ok()).toBeTruthy();
  const document = (await uploadResponse.json()) as { id: string };

  const adminLoginResponse = await request.post(`${backendBaseUrl}/api/auth/login`, {
    data: {
      email: "demo-admin@trawberry.local",
      password: "DemoAdmin123!",
    },
  });
  expect(adminLoginResponse.ok()).toBeTruthy();
  const adminLogin = (await adminLoginResponse.json()) as { accessToken: string };

  const approveDocumentResponse = await request.post(
    `${backendBaseUrl}/api/admin/sellers/${seller.userId}/documents/${document.id}/approve`,
    {
      headers: { Authorization: `Bearer ${adminLogin.accessToken}` },
      data: {},
    },
  );
  expect(approveDocumentResponse.ok()).toBeTruthy();

  const approveSellerResponse = await request.post(`${backendBaseUrl}/api/admin/sellers/${seller.userId}/approve`, {
    headers: { Authorization: `Bearer ${adminLogin.accessToken}` },
    data: {},
  });
  expect(approveSellerResponse.ok()).toBeTruthy();
}

test("seller creates shop, product, image, stock, public checkout, and sees order", async ({ browser, page, request }) => {
  test.setTimeout(120000);

  const stamp = Date.now();
  const sellerEmail = `seller-product-lifecycle-${stamp}@example.com`;
  const password = "password123";
  const shopName = `Lifecycle Shop ${stamp}`;
  const shopSlug = `lifecycle-shop-${stamp}`;
  const productName = `Lifecycle Product ${stamp}`;
  const phone = `+7997${String(stamp).slice(-7)}`;

  await approveSellerForUiLifecycle(request, sellerEmail, password);

  await page.goto("/login");
  await page.getByTestId("login-email").fill(sellerEmail);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/seller/dashboard");
  await expect(page.getByTestId("seller-shell")).toBeVisible();

  await page.goto("/seller/products");
  await expect(page.getByTestId("seller-products-page")).toBeVisible();
  await expect(page.getByTestId("create-shop-panel")).toBeVisible();
  await page.getByTestId("create-shop-name").fill(shopName);
  await page.getByTestId("create-shop-slug").fill(shopSlug);
  await page.getByTestId("create-shop-submit").click();
  await expect(page.getByText(`${shopName} created.`)).toBeVisible();
  await expect(page.getByTestId("create-product-panel")).toBeVisible();

  await page.getByTestId("create-product-name").fill(productName);
  await page.getByTestId("create-product-brand").fill("Lifecycle Brand");
  await page.getByTestId("create-product-category").fill("Lifecycle Category");
  await page.getByTestId("create-product-price").fill("137");
  await page.getByTestId("create-product-stock").fill("6");
  await page.getByTestId("create-product-description").fill("Created from browser seller product lifecycle E2E.");
  await page.getByTestId("create-product-submit").click();
  await expect(page).toHaveURL(/\/seller\/products\/[0-9a-f-]+$/i);
  await expect(page.getByTestId("seller-product-detail-page")).toBeVisible();
  await expect(page.getByTestId("product-local-title")).toHaveValue(productName);

  await page.getByTestId("product-stock-input").first().fill("9");
  await page.getByTestId("product-variant-save").first().click();
  const availableText = ruDict.seller.productDetail.availableCount.replace("{{value}}", "9");
  await expect(page.getByText(availableText)).toBeVisible();

  const manageImagesText = ruDict.seller.productDetail.manageImages;
  await page.getByRole("link", { name: manageImagesText }).click();
  await expect(page.getByTestId("seller-product-images-page")).toBeVisible();
  await page.getByTestId("product-image-input").setInputFiles({
    name: "product-image.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByTestId("product-image-upload").click();
  const uploadedText = ruDict.seller.productDetail.imagesUploaded.replace("{{count}}", "1");
  await expect(page.getByText(uploadedText)).toBeVisible();
  await expect(page.getByTestId("product-image-card")).toHaveCount(1);
  await page.goto(new URL(page.url()).pathname.replace(/\/images$/, ""));

  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  await customerPage.goto("/products");
  const publicSearch = customerPage.getByTestId("public-header-search").first();
  let productCard = customerPage.getByTestId("product-card").filter({ hasText: productName });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await publicSearch.fill(productName);
    await publicSearch.press("Enter");
    productCard = customerPage.getByTestId("product-card").filter({ hasText: productName });
    try {
      await expect(productCard).toHaveCount(1, { timeout: 4000 });
      break;
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }
      await customerPage.reload();
      await customerPage.waitForLoadState("networkidle");
    }
  }
  await productCard.getByTestId(/product-view-/).click();
  await expect(customerPage.getByRole("heading", { name: productName })).toBeVisible();
  await customerPage.getByTestId("continue-to-checkout").click();

  await customerPage.waitForURL(/\/checkout/);
  await customerPage.getByTestId("checkout-full-name").fill("Lifecycle Customer");
  await customerPage.getByTestId("checkout-phone").fill(phone);
  await customerPage.getByTestId("checkout-email").fill("lifecycle-customer@example.com");
  await customerPage.getByTestId("checkout-address").fill("Tverskaya Street 20, Moscow");
  await customerPage.getByTestId("checkout-note").fill(`Lifecycle E2E ${stamp}`);
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
  await page.getByTestId("seller-order-tab-ALL").click();
  await page.getByTestId("seller-order-search").fill(orderCode);
  await expect(page.getByTestId("seller-order-card").filter({ hasText: orderCode })).toBeVisible();
});
