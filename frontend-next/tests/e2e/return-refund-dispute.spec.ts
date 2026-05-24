import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

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

/**
 * Logs in as admin via the browser UI, retrying if the rate-limiter fires.
 * The backend throttles rapid login attempts — this waits for the warning
 * to disappear and retries up to 5 times with increasing back-off.
 */
async function loginAdminWithRetry(page: Page, maxAttempts = 5): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await page.goto("/admin-login");
    await page.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
    await page.getByTestId("admin-login-password").fill("DemoAdmin123!");
    await page.getByTestId("admin-login-submit").click();

    // Check whether we hit the rate-limit warning within 3 s
    const rateLimitMsg = page.locator("text=/quá nhanh|thử lại/i");
    const redirected = page.waitForURL("**/admin/dashboard", { timeout: 8000 }).then(() => "ok").catch(() => "timeout");
    const rateLimited = rateLimitMsg.waitFor({ timeout: 3000 }).then(() => "rate").catch(() => "none");

    const result = await Promise.race([redirected, rateLimited]);
    if (result === "ok") return;

    // Rate-limited or redirect timed out — wait with back-off and retry
    const backoffMs = 6000 * (attempt + 1);
    await page.waitForTimeout(backoffMs);
  }
  // Final attempt — let the normal waitForURL surface the error
  await page.goto("/admin-login");
  await page.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
  await page.getByTestId("admin-login-password").fill("DemoAdmin123!");
  await page.getByTestId("admin-login-submit").click();
  await page.waitForURL("**/admin/dashboard");
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
      legalAddress: "Moscow, Return Street 1",
      contactName: fullName,
      contactPhone: "+79990000082",
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
          name: "return-inn.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4\n% return refund dispute e2e\n"),
        },
      },
    },
  );
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
  return { token: sellerLogin.accessToken, password };
}

test("customer, seller, and admin complete a manual refund dispute with fee adjustment", async ({
  browser,
  page,
  request,
}) => {
  test.setTimeout(300000);

  const stamp = Date.now();
  const sellerEmail = `return-ui-seller-${stamp}@example.com`;
  const customerEmail = `return-ui-customer-${stamp}@example.com`;
  const customerPassword = "password123";
  const buyerPhone = `+7991${String(stamp).slice(-7)}`;
  const seller = await approveSeller(request, sellerEmail, "Return UI Seller");
  const adminLogin = await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
    method: "POST",
    data: { email: "demo-admin@trawberry.local", password: "DemoAdmin123!" },
  });

  const shop = await backendJson<{ id: string; name: string }>(request, "/api/shops", {
    method: "POST",
    headers: { Authorization: `Bearer ${seller.token}` },
    data: {
      name: `Return UI Shop ${stamp}`,
      slug: `return-ui-shop-${stamp}`,
    },
  });

  await backendJson(request, `/api/shops/${shop.id}/payment-settings`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${seller.token}` },
    data: {
      paymentMode: "STATIC_QR",
      status: "READY",
      bankName: "T-Bank",
      recipientName: "Return UI Seller",
      recipientPhone: "+79990000082",
      recipientAccount: "40817810000000000882",
      sbpPhone: "+79990000082",
      paymentInstruction: "Pay seller directly by QR.",
      allowPrepaidQr: true,
      allowPayOnDeliverySellerQr: true,
      allowDepositPayment: false,
    },
  });

  await backendJson(request, `/api/admin/finance/shops/${shop.id}/commission`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminLogin.accessToken}` },
    data: { commissionPercent: 3 },
  });

  const productNmId = 8500000 + (stamp % 100000);
  const product = await backendJson<{ id: string }>(
    request,
    `/api/shops/${shop.id}/products`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${seller.token}` },
      data: {
        wbNmId: productNmId,
        wbTitle: `Return UI Product ${stamp}`,
        localTitle: `Return UI Product ${stamp}`,
        localDescription: "Return UI product",
        categoryName: "Return Category",
        visibility: "ACTIVE",
        variants: [
          {
            chrtId: productNmId + 1,
            techSize: "Default",
            basePrice: 300,
            stockQuantity: 5,
            trackInventory: true,
            isActive: true,
          },
        ],
        images: [
          {
            wbUrl: "https://example.com/return-ui.jpg",
            localUrl: "https://example.com/return-ui.jpg",
            isMain: true,
            sortOrder: 0,
          },
        ],
      },
    },
  );

  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${seller.token}` },
    data: {},
  });

  await page.goto("/customer/register");
  await page.getByTestId("customer-register-name").fill("Return UI Customer");
  await page.getByTestId("customer-register-email").fill(customerEmail);
  await page.getByTestId("customer-register-password").fill(customerPassword);
  await page.getByTestId("customer-register-confirm-password").fill(customerPassword);
  await page.getByTestId("customer-register-submit").click();
  await page.waitForURL("**/customer/login?registered=1");
  await page.getByTestId("customer-login-email").fill(customerEmail);
  await page.getByTestId("customer-login-password").fill(customerPassword);
  await page.getByTestId("customer-login-submit").click();
  await page.waitForURL("**/customer/orders");

  const customerLogin = await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
    method: "POST",
    data: { email: customerEmail, password: customerPassword },
  });

  const checkout = await backendJson<{ orderId: string; checkoutCode: string }>(
    request,
    "/api/checkout/orders",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${customerLogin.accessToken}` },
      data: {
        shopId: shop.id,
        items: [{ productId: product.id, quantity: 1 }],
        customer: {
          fullName: "Return UI Customer",
          phone: buyerPhone,
          email: customerEmail,
          address: "Moscow, Return UI Street 1",
        },
        paymentMethod: "PREPAID_SELLER_QR",
      },
    },
  );

  await backendJson(request, `/api/public/orders/${checkout.orderId}/payment-proof`, {
    method: "POST",
    multipart: {
      phone: buyerPhone,
      buyerNote: "Transferred by QR.",
      file: {
        name: "return-payment-proof.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=",
          "base64",
        ),
      },
    },
  });

  await backendJson(request, `/api/shops/${shop.id}/payments/${checkout.orderId}/confirm`, {
    method: "POST",
    headers: { Authorization: `Bearer ${seller.token}` },
    data: { note: "Seller confirmed direct payment." },
  });

  await page.goto(`/customer/orders/${checkout.checkoutCode}`);
  await expect(page.getByTestId("checkout-receipt")).toBeVisible();
  await page.getByTestId("receipt-open-return-link").first().click();
  await expect(page.getByTestId("customer-return-order-select")).toBeVisible();
  await page.getByTestId("customer-return-order-select").selectOption(checkout.orderId);
  await page.getByTestId("customer-return-type-select").selectOption("REFUND_ONLY");
  await page.getByTestId("customer-return-reason-select").selectOption("WRONG_SIZE");
  await page.getByTestId("customer-return-requested-amount").fill("120");
  await page.getByTestId("customer-return-comment").fill("The size does not fit.");
  await page.getByTestId("customer-return-submit").click();
  await expect(page.getByTestId("customer-return-row")).toHaveCount(1);
  await expect(page.getByTestId("customer-return-detail")).toContainText("Waiting seller response");

  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await sellerPage.goto("/login");
  await sellerPage.getByTestId("login-email").fill(sellerEmail);
  await sellerPage.getByTestId("login-password").fill(seller.password);
  await sellerPage.getByTestId("login-submit").click();
  await sellerPage.waitForURL("**/seller/dashboard");
  await sellerPage.goto("/seller/returns");
  await expect(sellerPage.getByTestId("seller-return-row")).toHaveCount(1);
  await sellerPage.getByTestId("seller-return-action-select").selectOption("REJECT");
  await sellerPage.getByTestId("seller-return-comment").fill("Seller rejects before admin review.");
  sellerPage.once("dialog", (dialog) => void dialog.accept());
  await sellerPage.getByTestId("seller-return-respond").click();
  await expect(sellerPage.getByTestId("seller-return-detail")).toContainText("Seller rejected");

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await loginAdminWithRetry(adminPage);
  await adminPage.goto("/admin/returns");
  await adminPage.getByRole("combobox").first().selectOption("ALL");
  const adminCaseRow = adminPage.getByTestId("admin-return-row").filter({ hasText: shop.name }).first();
  await expect(adminCaseRow).toBeVisible();
  await adminCaseRow.click();
  await adminPage.getByTestId("admin-return-decision-select").selectOption("APPROVE");
  await adminPage.getByTestId("admin-return-approved-amount").fill("120");
  await adminPage.getByTestId("admin-return-note").fill("Admin approves partial refund.");
  await adminPage.getByTestId("admin-return-save-decision").click();
  await expect(adminCaseRow).toContainText("Refund pending");
  await expect(adminPage.getByTestId("admin-return-detail")).toContainText("Admin approves partial refund.");

  await sellerPage.reload();
  await sellerPage.getByTestId("seller-refund-amount").fill("120");
  await sellerPage.getByTestId("seller-refund-mark-sent").click();
  await expect(sellerPage.getByTestId("seller-return-detail")).toContainText("Refund marked sent");

  await page.reload();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByTestId("customer-confirm-refund-received").click();
  await expect(page.getByTestId("customer-return-detail")).toContainText("Refund confirmed");

  await sellerPage.goto("/seller/finance");
  await expect(sellerPage.getByTestId("seller-finance-page")).toContainText("RETURN_REFUND_CONFIRMED");

  await adminPage.goto("/admin/finance/seller-fees");
  const feeRow = adminPage.getByText(shop.name).locator("xpath=ancestor::tr[1]");
  await expect(feeRow).toContainText("5,40");

  await sellerContext.close();
  await adminContext.close();
});
