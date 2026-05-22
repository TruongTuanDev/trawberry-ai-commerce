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
        fullName: "Payment Choice Seller",
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
      legalName: "Payment Choice Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow",
      contactName: "Payment Choice Seller",
      contactPhone: "+79990000041",
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
          name: "payment-choice.pdf",
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

test("pay on delivery via seller QR works with manual Yandex flow", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(180000);

  const stamp = Date.now();
  const email = `payment-choice-${stamp}@example.com`;
  const password = "password123";
  const phone = `+7993${String(stamp).slice(-7)}`;

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
      headers: { Authorization: `Bearer ${sellerToken}`, Cookie: "" },
      data: {
        name: `Payment Choice Shop ${stamp}`,
        slug: `payment-choice-shop-${stamp}`,
      },
    },
  );

  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/seller/dashboard");

  await page.goto("/seller/payment-settings");
  await page.getByTestId("payment-settings-bank-name").fill("T-Bank");
  await page.getByTestId("payment-settings-recipient-name").fill(
    "Payment Choice Seller",
  );
  await page.getByTestId("payment-settings-recipient-phone").fill(
    "+79990000041",
  );
  await page.getByTestId("payment-settings-sbp-phone").fill("+79990000041");
  await page
    .getByTestId("payment-settings-recipient-account")
    .fill("40817810000000000444");
  await page
    .getByTestId("payment-settings-instruction")
    .fill("Pay the seller directly by QR/SBP.");
  await page.getByTestId("payment-settings-status").selectOption("READY");
  await page.getByText("Allow pay on delivery via seller QR").locator("..").getByRole("checkbox").check();
  await page.getByTestId("payment-settings-save").click();
  await expect(page.getByText("Payment settings saved.")).toBeVisible();

  await backendJson(request, `/api/shops/${shop.id}/payment-settings`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${sellerToken}`, Cookie: "" },
    data: {
      paymentMode: "STATIC_QR",
      status: "READY",
      bankName: "T-Bank",
      recipientName: "Payment Choice Seller",
      recipientPhone: "+79990000041",
      sbpPhone: "+79990000041",
      recipientAccount: "40817810000000000444",
      paymentInstruction: "Pay the seller directly by QR/SBP.",
      allowPrepaidQr: true,
      allowPayOnDeliverySellerQr: true,
      allowDepositPayment: false,
    },
  });
  await backendJson(request, `/api/shops/${shop.id}/delivery/settings`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${sellerToken}`, Cookie: "" },
    data: {
      pickupAddress: "Tverskaya 1, Moscow",
      pickupCity: "Moscow",
      pickupPostalCode: "101000",
      pickupContactPhone: "+74950000000",
      pickupContactName: "Seller Ops",
      pickupLatitude: 55.7558,
      pickupLongitude: 37.6176,
      enabledCarriers: ["YANDEX", "CDEK"],
      defaultCarrier: "YANDEX",
      sameCityPreferredCarrier: "YANDEX",
      interCityPreferredCarrier: "CDEK",
      fallbackCarrier: "CDEK",
      defaultWeightGram: 900,
      defaultLengthCm: 30,
      defaultWidthCm: 20,
      defaultHeightCm: 8,
    },
  });

  const product = await backendJson<{ id: string }>(
    request,
    `/api/shops/${shop.id}/products`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${sellerToken}`, Cookie: "" },
      data: {
        wbNmId: 7900000 + (stamp % 100000),
        wbTitle: `Payment Choice Product ${stamp}`,
        localTitle: `Payment Choice Product ${stamp}`,
        localDescription: "Payment choice flow product",
        categoryName: "Payment Choice Category",
        visibility: "ACTIVE",
        variants: [
          {
            chrtId: 8900000 + (stamp % 100000),
            techSize: "Default",
            basePrice: 219,
            stockQuantity: 6,
            trackInventory: true,
            isActive: true,
          },
        ],
        images: [
          {
            wbUrl: "https://example.com/payment-choice.jpg",
            localUrl: "https://example.com/payment-choice.jpg",
            isMain: true,
            sortOrder: 0,
          },
        ],
      },
    },
  );
  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerToken}`, Cookie: "" },
    data: {},
  });

  const buyerContext = await browser.newContext();
  const buyerPage = await buyerContext.newPage();
  await buyerPage.goto(`/products/${product.id}`);
  await buyerPage.getByTestId("add-to-cart").click();
  await buyerPage.goto("/cart");
  await buyerPage.getByTestId("cart-checkout").click();
  await buyerPage.getByTestId("checkout-full-name").fill("Payment Choice Buyer");
  await buyerPage.getByTestId("checkout-phone").fill(phone);
  await buyerPage
    .getByTestId("checkout-email")
    .fill(`payment-choice-buyer-${stamp}@example.com`);
  await buyerPage.getByTestId("checkout-address").fill("Lenina 10, Moscow");
  await buyerPage
    .getByTestId("payment-method-pay-on-delivery-seller-qr")
    .check({ force: true });
  await buyerPage.getByTestId("checkout-submit").click();

  const confirmation = buyerPage.getByTestId("checkout-confirmation");
  await expect(confirmation).toBeVisible();
  await expect(
    confirmation.getByText(
      "Thanh toán khi nhận hàng bằng QR/SBP cho người bán",
    ),
  ).toBeVisible();
  const confirmationText = await confirmation.innerText();
  const orderId =
    confirmationText.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    )?.[0] ?? "";
  expect(orderId).toBeTruthy();

  await page.goto(`/seller/orders/${orderId}`);
  await expect(page.getByTestId("seller-accept-pay-on-delivery")).toBeVisible();
  await page.getByTestId("seller-accept-pay-on-delivery").click();
  await expect(page.getByText("Payment step updated.")).toBeVisible();
  await expect(page.getByTestId("seller-order-status")).toContainText(
    "READY_TO_CREATE_YANDEX",
  );

  await page.getByTestId("manual-yandex-order-id").fill(`YANDEX-${stamp}`);
  await page.getByTestId("manual-yandex-claim-id").fill(`claim-${stamp}`);
  await page
    .getByTestId("manual-delivery-tracking-url")
    .fill(`https://track.example/yandex/${stamp}`);
  await page.getByTestId("manual-delivery-courier-name").fill("Courier Ivan");
  await page
    .getByTestId("manual-delivery-courier-phone")
    .fill("+79991112233");
  await page.getByTestId("manual-delivery-price").fill("450");
  await page.getByTestId("manual-delivery-save").click();
  await expect(page.getByTestId("seller-delivery-status")).toHaveText(
    "YANDEX_MANUAL_CREATED",
  );
  await page.getByTestId("manual-delivery-mark-delivered").click();
  await expect(page.getByTestId("seller-delivery-status")).toHaveText(
    "DELIVERED",
  );

  await buyerPage.goto(`/orders/${orderId}?phone=${encodeURIComponent(phone)}`);
  await expect(
    buyerPage.getByText(
      "Vui lòng thanh toán cho người bán bằng QR/SBP nếu chưa thanh toán.",
    ),
  ).toBeVisible();
  await buyerPage
    .getByRole("textbox", { name: "Buyer note" })
    .fill("Paid after delivery by seller QR.");
  await buyerPage.getByTestId("payment-proof-submit").click();
  await expect(
    buyerPage.getByText("Marked as paid after delivery. Seller can review it now."),
  ).toBeVisible();

  await page.goto(`/seller/orders/${orderId}`);
  await expect(
    page.getByTestId("seller-confirm-delivery-payment"),
  ).toBeVisible();
  await page.getByTestId("seller-confirm-delivery-payment").click();
  await expect(page.getByText("Payment step updated.")).toBeVisible();

  const adminPage = await browser.newPage();
  await adminPage.goto("/admin-login");
  await adminPage.getByTestId("admin-login-email").fill(
    "demo-admin@trawberry.local",
  );
  await adminPage.getByTestId("admin-login-password").fill("DemoAdmin123!");
  await adminPage.getByTestId("admin-login-submit").click();
  await adminPage.waitForURL("**/admin/dashboard");
  await adminPage.goto("/admin/payments-supervision");
  await expect(
    adminPage.getByTestId("admin-payments-supervision-page"),
  ).toBeVisible();

  await adminPage.close();
  await buyerContext.close();
});
