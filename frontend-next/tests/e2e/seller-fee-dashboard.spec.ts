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
  password: string,
) {
  const register = await backendJson<{ userId: string }>(
    request,
    "/api/auth/register",
    {
      method: "POST",
      data: {
        email,
        password,
        fullName: "Seller Fee Seller",
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
      legalName: "Seller Fee Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow",
      contactName: "Seller Fee Seller",
      contactPhone: "+79990000071",
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
          name: "seller-fee.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4\n"),
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
}

test("admin commission settings and seller finance dashboard work end-to-end", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(180000);

  const stamp = Date.now();
  const email = `seller-fee-${stamp}@example.com`;
  const password = "password123";
  const buyerPhone = `+7994${String(stamp).slice(-7)}`;
  const productNmId = 7950000 + (stamp % 100000);

  await approveSeller(request, email, password);

  const sellerToken = (
    await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
      method: "POST",
      data: { email, password },
    })
  ).accessToken;

  const shop = await backendJson<{ id: string; name: string }>(
    request,
    "/api/shops",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${sellerToken}` },
      data: {
        name: `Seller Fee Shop ${stamp}`,
        slug: `seller-fee-shop-${stamp}`,
      },
    },
  );

  await backendJson(request, `/api/shops/${shop.id}/payment-settings`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${sellerToken}` },
    data: {
      paymentMode: "STATIC_QR",
      status: "READY",
      bankName: "T-Bank",
      recipientName: "Seller Fee Seller",
      recipientPhone: "+79990000071",
      recipientAccount: "40817810000000000771",
      sbpPhone: "+79990000071",
      paymentInstruction: "Pay seller directly by QR.",
      allowPrepaidQr: true,
      allowPayOnDeliverySellerQr: true,
      allowDepositPayment: false,
    },
  });

  const product = await backendJson<{ id: string }>(
    request,
    `/api/shops/${shop.id}/products`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${sellerToken}` },
      data: {
        wbNmId: productNmId,
        wbTitle: `Seller Fee Product ${stamp}`,
        localTitle: `Seller Fee Product ${stamp}`,
        localDescription: "Seller fee flow product",
        categoryName: "Seller Fee Category",
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
            wbUrl: "https://example.com/seller-fee.jpg",
            localUrl: "https://example.com/seller-fee.jpg",
            isMain: true,
            sortOrder: 0,
          },
        ],
      },
    },
  );

  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerToken}` },
    data: {},
  });

  await page.goto("/admin-login");
  await page.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
  await page.getByTestId("admin-login-password").fill("DemoAdmin123!");
  await page.getByTestId("admin-login-submit").click();
  await page.waitForURL("**/admin/dashboard");

  await page.goto("/admin/finance/seller-fees");
  await expect(page.getByTestId("admin-seller-fees-page")).toBeVisible();
  await page.getByTestId(`admin-commission-input-${shop.id}`).fill("3");
  await page.getByTestId(`admin-save-commission-${shop.id}`).click();
  await expect(page.getByText(`Commission saved for ${shop.name}.`)).toBeVisible();

  const checkout = await backendJson<{ orderId: string }>(
    request,
    "/api/checkout/orders",
    {
      method: "POST",
      data: {
        shopId: shop.id,
        items: [{ productId: product.id, quantity: 1 }],
        customer: {
          fullName: "Seller Fee Buyer",
          phone: buyerPhone,
          email: `seller-fee-buyer-${stamp}@example.com`,
          address: "Moscow, Finance Street 1",
        },
        paymentMethod: "PREPAID_SELLER_QR",
      },
    },
  );

  await backendJson(
    request,
    `/api/public/orders/${checkout.orderId}/payment-proof`,
    {
      method: "POST",
      multipart: {
        phone: buyerPhone,
        buyerNote: "Transferred by QR.",
        file: {
          name: "payment-proof.png",
          mimeType: "image/png",
          buffer: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=",
            "base64",
          ),
        },
      },
    },
  );

  await backendJson(
    request,
    `/api/shops/${shop.id}/payments/${checkout.orderId}/confirm`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${sellerToken}` },
      data: { note: "Seller verified payment." },
    },
  );

  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await sellerPage.goto("/login");
  await sellerPage.getByTestId("login-email").fill(email);
  await sellerPage.getByTestId("login-password").fill(password);
  await sellerPage.getByTestId("login-submit").click();
  await sellerPage.waitForURL("**/seller/dashboard");

  await sellerPage.goto("/seller/finance");
  await expect(sellerPage.getByTestId("seller-finance-page")).toBeVisible();
  await expect(
    sellerPage.getByTestId("seller-finance-confirmed-revenue-this-month"),
  ).toContainText("300");
  await expect(
    sellerPage.getByTestId("seller-finance-estimated-platform-fee"),
  ).toContainText("9");

  await page.goto("/admin/finance/seller-fees");
  const row = page
    .getByText(shop.name)
    .locator("xpath=ancestor::tr[1]");
  await expect(row).toContainText("9");
  await page.getByTestId(`admin-generate-invoice-${shop.id}`).click();
  await expect(
    page.getByText(`Invoice generated for ${shop.name}`),
  ).toBeVisible();

  const invoice = await backendJson<Array<{ id: string; shopId: string; billingPeriod: string }>>(
    request,
    "/api/admin/finance/invoices",
    {
      headers: { Authorization: `Bearer ${(
        await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
          method: "POST",
          data: {
            email: "demo-admin@trawberry.local",
            password: "DemoAdmin123!",
          },
        })
      ).accessToken}` },
    },
  );

  const shopInvoice = invoice.find((entry) => entry.shopId === shop.id);
  expect(shopInvoice).toBeTruthy();

  await page.getByTestId(`admin-mark-invoice-paid-${shopInvoice!.id}`).click();
  await expect(page.getByText("Invoice marked as paid.")).toBeVisible();

  await sellerPage.reload();
  await expect(
    sellerPage.getByTestId(`seller-finance-invoice-status-${shopInvoice!.id}`),
  ).toHaveText("PAID");

  await sellerContext.close();
});
