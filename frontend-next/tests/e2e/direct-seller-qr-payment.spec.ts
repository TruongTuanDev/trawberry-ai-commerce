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
      legalAddress: "Moscow, Seller QR Street 1",
      contactName: fullName,
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
          name: "seller-qr-inn.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4\n% direct seller qr e2e\n"),
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

async function createShop(
  request: APIRequestContext,
  token: string,
  input: { name: string; slug: string },
) {
  return backendJson<{ id: string; name: string }>(request, "/api/shops", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    data: input,
  });
}

async function createPublishedProduct(
  request: APIRequestContext,
  input: {
    token: string;
    shopId: string;
    productName: string;
    wbNmId: number;
  },
) {
  const product = await backendJson<{
    id: string;
    variants: Array<{ id: string }>;
  }>(request, `/api/shops/${input.shopId}/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.token}`, Cookie: "" },
    data: {
      wbNmId: input.wbNmId,
      wbTitle: input.productName,
      localTitle: input.productName,
      localDescription: `${input.productName} direct QR product`,
      categoryName: "Direct QR Category",
      visibility: "ACTIVE",
      variants: [
        {
          chrtId: input.wbNmId + 10,
          techSize: "Default",
          basePrice: 139,
          stockQuantity: 6,
          trackInventory: true,
          isActive: true,
        },
      ],
    },
  });

  await backendJson(
    request,
    `/api/shops/${input.shopId}/products/${product.id}/images`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${input.token}`, Cookie: "" },
      multipart: {
        files: {
          name: "direct-qr-product.png",
          mimeType: "image/png",
          buffer: pngBuffer,
        },
      },
    },
  );

  await backendJson(
    request,
    `/api/shops/${input.shopId}/products/${product.id}/publish`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${input.token}`, Cookie: "" },
      data: {},
    },
  );

  return product;
}

test("seller configures QR payment, buyer uploads proof, seller confirms, admin supervises", async ({
  browser,
  page,
  request,
}) => {
  test.setTimeout(180000);

  const stamp = Date.now();
  const sellerEmail = `direct-qr-seller-${stamp}@example.com`;
  const seller = await approveSeller(request, sellerEmail, "Direct QR Seller");
  const shop = await createShop(request, seller.token, {
    name: `Direct QR Shop ${stamp}`,
    slug: `direct-qr-shop-${stamp}`,
  });

  await page.goto("/login");
  await page.getByTestId("login-email").fill(sellerEmail);
  await page.getByTestId("login-password").fill(seller.password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/seller/dashboard");

  await page.goto("/seller/payment-settings");
  await expect(page.getByTestId("seller-payment-settings-page")).toBeVisible();
  await page.getByTestId("payment-settings-bank-name").fill("T-Bank");
  await page.getByTestId("payment-settings-recipient-name").fill("Direct QR Seller");
  await page.getByTestId("payment-settings-recipient-phone").fill("+79990000011");
  await page.getByTestId("payment-settings-sbp-phone").fill("+79990000011");
  await page.getByTestId("payment-settings-recipient-account").fill("40817810000000000123");
  await page.getByTestId("payment-settings-instruction").fill("Scan the seller QR and transfer the exact order amount.");
  await page.getByTestId("payment-settings-status").selectOption("READY");
  await page.getByTestId("payment-settings-save").click();
  await expect(page.getByText("Payment settings saved.")).toBeVisible();

  await page.getByTestId("payment-settings-qr-file").setInputFiles({
    name: "seller-qr.png",
    mimeType: "image/png",
    buffer: pngBuffer,
  });
  await page.getByTestId("payment-settings-qr-upload").click();
  await expect(page.getByText("Static QR uploaded.")).toBeVisible();
  await expect(page.getByTestId("payment-settings-qr-preview")).toBeVisible();

  const product = await createPublishedProduct(request, {
    token: seller.token,
    shopId: shop.id,
    productName: `Direct QR Product ${stamp}`,
    wbNmId: 8800000 + (stamp % 100000),
  });

  const buyerContext = await browser.newContext();
  const buyerPage = await buyerContext.newPage();
  const phone = `+7996${String(stamp).slice(-7)}`;

  await buyerPage.goto(`/products/${product.id}`);
  await buyerPage.getByTestId("add-to-cart").click();
  await buyerPage.goto("/cart");
  await buyerPage.getByTestId("cart-checkout").click();
  await buyerPage.getByTestId("checkout-full-name").fill("Direct QR Buyer");
  await buyerPage.getByTestId("checkout-phone").fill(phone);
  await buyerPage.getByTestId("checkout-email").fill(`direct-qr-buyer-${stamp}@example.com`);
  await buyerPage.getByTestId("checkout-address").fill("Moscow, Buyer Street 1");
  await buyerPage.getByTestId("checkout-note").fill("Please confirm after transfer.");
  await buyerPage.getByTestId("checkout-submit").click();

  const confirmation = buyerPage.getByTestId("checkout-confirmation");
  await expect(confirmation).toBeVisible();
  const confirmationText = await confirmation.innerText();
  const orderCode = confirmationText.match(/ORD-\d+-\d+/)?.[0] ?? "";
  const orderId =
    confirmationText.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    )?.[0] ?? "";
  expect(orderCode).toBeTruthy();
  expect(orderId).toBeTruthy();
  const confirmationCard = buyerPage
    .getByTestId("checkout-order-card")
    .filter({ hasText: shop.name });
  await expect(
    confirmationCard.getByText("Scan the seller QR and transfer the exact order amount."),
  ).toBeVisible();
  await expect(confirmationCard.getByAltText("Seller payment QR")).toBeVisible();

  await buyerPage.goto("/orders/track");
  await buyerPage.getByTestId("track-order-code").fill(orderCode);
  await buyerPage.getByTestId("track-order-phone").fill(phone);
  await buyerPage.getByTestId("track-order-submit").click();
  await expect(buyerPage).toHaveURL(new RegExp(`/orders/${orderId}\\?phone=`));
  await buyerPage.getByRole("textbox", { name: "Buyer note" }).fill("Transferred via T-Bank SBP.");
  await buyerPage.getByTestId("payment-proof-input").setInputFiles({
    name: "buyer-proof.png",
    mimeType: "image/png",
    buffer: pngBuffer,
  });
  await buyerPage.getByTestId("payment-proof-submit").click();
  await expect(buyerPage.getByText("Marked as paid. Seller can review the proof now.")).toBeVisible();
  await expect(buyerPage.getByText("BUYER_MARKED_PAID")).toBeVisible();
  await expect(buyerPage.getByText("Latest buyer note: Transferred via T-Bank SBP.")).toBeVisible();

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/admin-login");
  await adminPage.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
  await adminPage.getByTestId("admin-login-password").fill("DemoAdmin123!");
  await adminPage.getByTestId("admin-login-submit").click();
  await adminPage.waitForURL("**/admin/dashboard");
  await adminPage.goto("/admin/payments-supervision");
  await expect(adminPage.getByTestId("admin-payments-supervision-page")).toBeVisible();
  await adminPage
    .locator("select")
    .first()
    .selectOption("PENDING");
  const adminQueueItem = adminPage.getByRole("button", { name: new RegExp(orderCode) }).first();
  await expect(adminQueueItem).toBeVisible();
  await adminQueueItem.click();
  await expect(adminPage.getByText("Buyer proof status: BUYER_MARKED_PAID")).toBeVisible();
  await expect(adminPage.getByText("Buyer note: Transferred via T-Bank SBP.")).toBeVisible();
  await expect(adminPage.getByTestId("admin-payment-confirm")).toBeVisible();

  const sellerReviewContext = await browser.newContext();
  const sellerReviewPage = await sellerReviewContext.newPage();
  await sellerReviewPage.goto("/login");
  await sellerReviewPage.getByTestId("login-email").fill(sellerEmail);
  await sellerReviewPage.getByTestId("login-password").fill(seller.password);
  await sellerReviewPage.getByTestId("login-submit").click();
  await sellerReviewPage.waitForURL("**/seller/dashboard");
  await sellerReviewPage.goto("/seller/payments-to-confirm");
  await expect(sellerReviewPage.getByText(orderCode)).toBeVisible();
  await expect(sellerReviewPage.getByText("BUYER_MARKED_PAID")).toBeVisible();
  await sellerReviewPage.getByRole("link", { name: orderCode }).click();
  await expect(sellerReviewPage.getByTestId("seller-payment-detail-page")).toBeVisible();
  await expect(sellerReviewPage.getByText("Buyer payment note: Transferred via T-Bank SBP.")).toBeVisible();
  sellerReviewPage.once("dialog", (dialog) => dialog.accept());
  await sellerReviewPage.getByTestId("seller-mark-paid-button").click();
  await expect(sellerReviewPage.getByText("Payment confirmed.")).toBeVisible();
  await expect(sellerReviewPage.getByTestId("seller-payment-status")).toHaveText("PAID");
  await expect(
    sellerReviewPage.locator("span").filter({ hasText: "SELLER_CONFIRMED" }).first(),
  ).toBeVisible();

  await buyerPage.reload();
  await expect(buyerPage.getByTestId("tracked-payment-status")).toHaveText("PAID");

  await sellerReviewContext.close();
  await adminContext.close();
  await buyerContext.close();
});
