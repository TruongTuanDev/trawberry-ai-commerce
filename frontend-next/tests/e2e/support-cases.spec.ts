import { expect, test, type APIRequestContext } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

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
      legalAddress: "Moscow, Support Street 1",
      contactName: fullName,
      contactPhone: "+79990000009",
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
        buffer: Buffer.from("%PDF-1.4\n% support-cases e2e\n"),
      },
    },
  });
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

async function createPublicProduct(
  request: APIRequestContext,
  input: {
    token: string;
    shopName: string;
    shopSlug: string;
    productName: string;
    price: number;
    stock: number;
    wbNmId: number;
  },
) {
  const shop = await backendJson<{ id: string; name: string }>(request, "/api/shops", {
    method: "POST",
    headers: { Authorization: `Bearer ${input.token}`, Cookie: "" },
    data: {
      name: input.shopName,
      slug: input.shopSlug,
      paymentInstructions: `Manual transfer for ${input.shopName}`,
    },
  });
  const product = await backendJson<{ id: string; variants: Array<{ id: string }> }>(
    request,
    `/api/shops/${shop.id}/products`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${input.token}`, Cookie: "" },
      data: {
        wbNmId: input.wbNmId,
        wbTitle: input.productName,
        localTitle: input.productName,
        localDescription: `${input.productName} description`,
        categoryName: "Support Category",
        visibility: "ACTIVE",
        variants: [
          {
            chrtId: input.wbNmId + 10,
            techSize: "Default",
            basePrice: input.price,
            stockQuantity: input.stock,
            trackInventory: true,
            isActive: true,
          },
        ],
      },
    },
  );
  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.token}`, Cookie: "" },
    multipart: {
      files: {
        name: `${input.productName}.png`,
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
    headers: { Authorization: `Bearer ${input.token}`, Cookie: "" },
    data: {},
  });
  return { shop, product };
}

test("customer, admin, and seller work a support case from checkout receipt", async ({ browser, page, request }) => {
  test.setTimeout(210000);

  const stamp = Date.now();
  const sellerAEmail = `support-ui-a-${stamp}@example.com`;
  const sellerBEmail = `support-ui-b-${stamp}@example.com`;
  const sellerA = await approveSeller(request, sellerAEmail, "Support UI Seller A");
  const sellerB = await approveSeller(request, sellerBEmail, "Support UI Seller B");
  const productA = await createPublicProduct(request, {
    token: sellerA.token,
    shopName: `Support UI Shop A ${stamp}`,
    shopSlug: `support-ui-shop-a-${stamp}`,
    productName: `Support UI Product A ${stamp}`,
    price: 100,
    stock: 10,
    wbNmId: 8300000 + (stamp % 100000),
  });
  const productB = await createPublicProduct(request, {
    token: sellerB.token,
    shopName: `Support UI Shop B ${stamp}`,
    shopSlug: `support-ui-shop-b-${stamp}`,
    productName: `Support UI Product B ${stamp}`,
    price: 200,
    stock: 10,
    wbNmId: 9300000 + (stamp % 100000),
  });

  const customerEmail = `support-ui-customer-${stamp}@example.com`;
  const password = "password123";
  const checkoutCaseSubject = `Support checkout case ${stamp}`;
  const orderCaseSubject = `Support order case ${stamp}`;
  const publicAdminUpdate = `Public admin update ${stamp}.`;
  const adminApi = await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
    method: "POST",
    data: { email: "demo-admin@trawberry.local", password: "DemoAdmin123!" },
  });

  await page.goto("/customer/register");
  await page.getByTestId("customer-register-name").fill("Support UI Customer");
  await page.getByTestId("customer-register-email").fill(customerEmail);
  await page.getByTestId("customer-register-password").fill(password);
  await page.getByTestId("customer-register-submit").click();
  await page.waitForURL("**/customer/orders");

  await page.goto(`/products/${productA.product.id}`);
  await page.getByTestId("product-quantity-input").fill("1");
  await page.getByTestId("add-to-cart").click();
  await page.goto(`/products/${productB.product.id}`);
  await page.getByTestId("product-quantity-input").fill("1");
  await page.getByTestId("add-to-cart").click();
  await page.goto("/cart");
  await page.getByTestId("cart-checkout").click();

  const phone = `+7997${String(stamp).slice(-7)}`;
  await page.getByTestId("checkout-phone").fill(phone);
  await page.getByTestId("checkout-address").fill("Support UI Address");
  await page.getByTestId("checkout-submit").click();
  await expect(page.getByTestId("checkout-confirmation")).toBeVisible();
  const checkoutCode = (await page.getByTestId("checkout-confirmation").innerText()).match(/CHK-\d+-\d+/)?.[0];
  expect(checkoutCode).toBeTruthy();

  await page.goto(`/customer/orders/${checkoutCode}`);
  await expect(page.getByTestId("customer-support-section")).toBeVisible();
  await page.getByTestId("customer-support-issue-type").selectOption("DELIVERY_DELAY");
  await page.getByTestId("customer-support-subject").fill(checkoutCaseSubject);
  await page.getByTestId("customer-support-description").fill("The parent checkout needs a combined update.");
  await page.getByTestId("customer-support-submit").click();
  await expect(page.getByTestId("customer-support-case-card").filter({ hasText: checkoutCaseSubject })).toBeVisible();

  await page.getByTestId("customer-support-issue-type").selectOption("WRONG_ITEM");
  await page.getByTestId("customer-support-target").selectOption({ index: 1 });
  await page.getByTestId("customer-support-subject").fill(orderCaseSubject);
  await page.getByTestId("customer-support-description").fill("This is tied to the first shop order.");
  await page.getByTestId("customer-support-submit").click();
  await expect(page.getByTestId("customer-support-case-card").filter({ hasText: orderCaseSubject })).toBeVisible();

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/login");
  await adminPage.getByTestId("login-email").fill("demo-admin@trawberry.local");
  await adminPage.getByTestId("login-password").fill("DemoAdmin123!");
  await adminPage.getByTestId("login-submit").click();
  await adminPage.waitForURL(/\/(seller\/dashboard|admin\/dashboard)/);
  await adminPage.goto("/admin/support-cases");
  await expect(adminPage.getByTestId("admin-support-case-row").filter({ hasText: checkoutCaseSubject })).toBeVisible();
  await adminPage.getByTestId("admin-support-case-row").filter({ hasText: checkoutCaseSubject }).click();
  await adminPage.getByTestId("admin-support-status-select").selectOption("IN_REVIEW");
  const adminCases = await backendJson<{ items: Array<{ id: string; subject: string }> }>(
    request,
    `/api/admin/support-cases?checkoutCode=${encodeURIComponent(checkoutCode!)}`,
    { headers: { Authorization: `Bearer ${adminApi.accessToken}` } },
  );
  const checkoutCase = adminCases.items.find((item) => item.subject === checkoutCaseSubject);
  expect(checkoutCase).toBeTruthy();
  await backendJson(
    request,
    `/api/admin/support-cases/${checkoutCase!.id}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${adminApi.accessToken}` },
      data: { message: publicAdminUpdate, isInternal: false },
    },
  );
  await backendJson(
    request,
    `/api/admin/support-cases/${checkoutCase!.id}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${adminApi.accessToken}` },
      data: { message: "Internal admin note.", isInternal: true },
    },
  );

  await expect
    .poll(
      async () => {
        await page.goto(`/customer/orders/${checkoutCode}`);
        await page.getByTestId("customer-support-case-card").filter({ hasText: checkoutCaseSubject }).click();
        return await page.getByTestId("customer-support-thread").textContent();
      },
      { timeout: 30000 },
    )
    .toContain(publicAdminUpdate);
  await expect(page.getByTestId("customer-support-thread")).not.toContainText("Internal admin note.");

  const sellerAContext = await browser.newContext();
  const sellerAPage = await sellerAContext.newPage();
  await sellerAPage.goto("/login");
  await sellerAPage.getByTestId("login-email").fill(sellerAEmail);
  await sellerAPage.getByTestId("login-password").fill(sellerA.password);
  await sellerAPage.getByTestId("login-submit").click();
  await sellerAPage.waitForURL("**/seller/dashboard");
  await sellerAPage.goto("/seller/support-cases");
  await expect(sellerAPage.getByTestId("seller-support-case-row").filter({ hasText: orderCaseSubject })).toBeVisible();
  await sellerAPage.getByTestId("seller-support-case-row").filter({ hasText: orderCaseSubject }).click();
  await sellerAPage.getByTestId("seller-support-reply-message").fill("Seller A acknowledged the issue.");
  await sellerAPage.getByTestId("seller-support-reply-submit").click();
  await expect(sellerAPage.getByTestId("seller-support-thread")).toContainText("Seller A acknowledged the issue.");
  await expect(sellerAPage.getByTestId("seller-support-thread")).not.toContainText("Internal admin note.");
  await sellerAContext.close();

  const sellerBContext = await browser.newContext();
  const sellerBPage = await sellerBContext.newPage();
  await sellerBPage.goto("/login");
  await sellerBPage.getByTestId("login-email").fill(sellerBEmail);
  await sellerBPage.getByTestId("login-password").fill(sellerB.password);
  await sellerBPage.getByTestId("login-submit").click();
  await sellerBPage.waitForURL("**/seller/dashboard");
  await sellerBPage.goto("/seller/support-cases");
  await expect(sellerBPage.getByTestId("seller-support-case-row").filter({ hasText: orderCaseSubject })).toHaveCount(0);
  await sellerBContext.close();

  await adminContext.close();
});
