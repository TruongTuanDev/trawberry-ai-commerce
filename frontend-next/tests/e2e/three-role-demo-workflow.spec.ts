import { expect, test } from "@playwright/test";

test.use({
  video: "on",
});

const demoAccounts = {
  admin: {
    email: "demo-admin@trawberry.local",
    password: "DemoAdmin123!",
  },
  seller: {
    email: "demo-seller@trawberry.local",
    password: "DemoSeller123!",
  },
  customer: {
    email: "demo-customer@trawberry.local",
    password: "DemoCustomer123!",
  },
};

async function addCaption(page: import("@playwright/test").Page, text: string) {
  await page.evaluate((message) => {
    let caption = document.querySelector<HTMLElement>("[data-demo-caption]");
    if (!caption) {
      caption = document.createElement("div");
      caption.dataset.demoCaption = "true";
      caption.style.position = "fixed";
      caption.style.left = "24px";
      caption.style.bottom = "24px";
      caption.style.zIndex = "2147483647";
      caption.style.maxWidth = "min(620px, calc(100vw - 48px))";
      caption.style.border = "1px solid rgba(255,255,255,0.28)";
      caption.style.borderRadius = "16px";
      caption.style.background = "rgba(35, 24, 20, 0.88)";
      caption.style.color = "white";
      caption.style.font = "600 15px/1.5 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      caption.style.padding = "12px 16px";
      caption.style.boxShadow = "0 18px 48px rgba(0,0,0,0.28)";
      document.body.appendChild(caption);
    }
    caption.textContent = message;
  }, text);
  await page.waitForTimeout(900);
}

async function login(page: import("@playwright/test").Page, email: string, password: string, caption: string) {
  await page.goto("/login");
  await addCaption(page, caption);
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/seller/dashboard");
  await page.waitForLoadState("networkidle");
}

async function clearSession(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.context().clearCookies();
}

test("three role demo workflow video", async ({ page, request }) => {
  test.setTimeout(180000);

  const stamp = Date.now();
  const productName = `Three Role Demo Product ${stamp}`;
  const phone = `+7998${String(stamp).slice(-7)}`;
  const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";
  const sellerLoginResponse = await request.post(`${backendBaseUrl}/api/auth/login`, {
    data: {
      email: demoAccounts.seller.email,
      password: demoAccounts.seller.password,
    },
  });
  expect(sellerLoginResponse.ok()).toBeTruthy();
  const sellerLogin = (await sellerLoginResponse.json()) as { userId: string; approvalStatus: string };
  expect(sellerLogin.approvalStatus).toBe("APPROVED");

  await page.setViewportSize({ width: 1440, height: 1000 });

  await login(page, demoAccounts.admin.email, demoAccounts.admin.password, "ADMIN: sign in with the demo admin account.");
  await page.goto(`/admin/sellers/${sellerLogin.userId}`);
  await expect(page.getByTestId("admin-shell")).toBeVisible();
  await addCaption(page, "ADMIN: review the approved demo seller account.");
  await expect(page.getByTestId("admin-seller-detail-page")).toBeVisible();
  await expect(page.getByText(demoAccounts.seller.email)).toBeVisible();
  await expect(page.getByTestId("admin-seller-status")).toHaveText("APPROVED");
  await page.waitForTimeout(1200);
  await clearSession(page);

  await login(page, demoAccounts.seller.email, demoAccounts.seller.password, "SELLER: sign in with the approved demo seller account.");
  await expect(page.getByTestId("seller-shell")).toBeVisible();
  await page.goto("/seller/products");
  await expect(page.getByTestId("seller-products-page")).toBeVisible();
  await addCaption(page, "SELLER: create a product in the existing Demo Strawberry Store.");
  await page.getByTestId("create-product-name").fill(productName);
  await page.getByTestId("create-product-brand").fill("Three Role Brand");
  await page.getByTestId("create-product-category").fill("Workflow Demo");
  await page.getByTestId("create-product-price").fill("88");
  await page.getByTestId("create-product-stock").fill("5");
  await page.getByTestId("create-product-description").fill("Created during the three-role recorded workflow.");
  await page.getByTestId("create-product-submit").click();
  await expect(page).toHaveURL(/\/seller\/products\/[0-9a-f-]+$/i);
  await expect(page.getByTestId("seller-product-detail-page")).toBeVisible();
  await expect(page.getByTestId("product-local-title")).toHaveValue(productName);
  await page.getByRole("link", { name: "Manage images" }).click();
  await expect(page.getByTestId("seller-product-images-page")).toBeVisible();
  await page.getByTestId("product-image-input").setInputFiles({
    name: "three-role-product.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByTestId("product-image-upload").click();
  await expect(page.getByText("Uploaded 1 image.")).toBeVisible();
  await addCaption(page, "SELLER: product is live and ready for customer checkout.");
  await page.waitForTimeout(1200);
  await page.getByTestId("logout-button").click();
  await page.waitForURL(/\/login/);

  await login(page, demoAccounts.customer.email, demoAccounts.customer.password, "CUSTOMER: sign in with the demo customer account.");
  await addCaption(page, "CUSTOMER: browse the public catalog and find the seller's new product.");
  await page.goto("/products");
  await page.getByLabel("Search catalog").fill(productName);
  await page.getByRole("button", { name: "Search" }).click();
  const productCard = page.getByTestId("product-card").filter({ hasText: productName });
  await expect(productCard).toHaveCount(1);
  await productCard.getByRole("link", { name: "View" }).click();
  await expect(page.getByRole("heading", { name: productName })).toBeVisible();
  await page.getByTestId("product-quantity-input").fill("1");
  await addCaption(page, "CUSTOMER: add quantity and continue to checkout.");
  await page.getByTestId("continue-to-checkout").click();

  await page.waitForURL(/\/checkout\?/);
  await addCaption(page, "CUSTOMER: complete checkout with backend-calculated totals.");
  await page.getByTestId("checkout-full-name").fill("Demo Customer");
  await page.getByTestId("checkout-phone").fill(phone);
  await page.getByTestId("checkout-email").fill(demoAccounts.customer.email);
  await page.getByTestId("checkout-address").fill("Tverskaya Street 20, Moscow");
  await page.getByTestId("checkout-note").fill(`Three role workflow ${stamp}`);
  await page.getByTestId("checkout-submit").click();
  await expect(page.getByTestId("checkout-confirmation")).toBeVisible();
  await addCaption(page, "CUSTOMER: order created; open the public tracking page.");
  await page.getByTestId("confirmation-track-link").click();
  await expect(page.getByTestId("tracked-order-page")).toBeVisible();
  await page.waitForTimeout(1800);

  await clearSession(page);
  await login(page, demoAccounts.seller.email, demoAccounts.seller.password, "SELLER: return to confirm the customer order appears in seller orders.");
  await page.goto("/seller/orders");
  await addCaption(page, "SELLER: the order from the customer workflow is visible for fulfillment.");
  await page.getByPlaceholder("Search by order, customer, phone, product").fill(phone);
  await expect(page.getByTestId("seller-order-card").filter({ hasText: productName })).toBeVisible();
  await page.waitForTimeout(2000);
});
