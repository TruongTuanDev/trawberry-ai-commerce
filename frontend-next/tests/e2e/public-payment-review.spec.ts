import { expect, test } from "@playwright/test";

const demoSeller = {
  email: "demo-seller@trawberry.local",
  password: "DemoSeller123!",
};

test("customer uploads proof, seller marks paid, customer sees paid status", async ({ browser }) => {
  test.setTimeout(90000);

  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  const phone = `+7999${Date.now().toString().slice(-7)}`;

  await customerPage.goto("/products");
  const seededCard = customerPage.getByTestId("product-card").filter({ hasText: "Linen Bloom Dress" });
  await expect(seededCard).toHaveCount(1);
  await seededCard.getByRole("link", { name: "View" }).click();

  await expect(customerPage).toHaveURL(/\/products\/.+/);
  await customerPage.getByTestId("product-quantity-input").fill("1");
  await customerPage.getByTestId("continue-to-checkout").click();

  await customerPage.waitForURL(/\/checkout\?/);
  await customerPage.getByTestId("checkout-full-name").fill("Demo Customer");
  await customerPage.getByTestId("checkout-phone").fill(phone);
  await customerPage.getByTestId("checkout-email").fill("demo-customer@example.com");
  await customerPage.getByTestId("checkout-address").fill("Demo Address");
  await customerPage.getByTestId("checkout-note").fill(`Payment review E2E ${phone}`);
  await customerPage.getByTestId("checkout-submit").click();

  await expect(customerPage.getByTestId("checkout-confirmation")).toBeVisible();
  const confirmationText = await customerPage.getByTestId("checkout-confirmation").innerText();
  const orderCode = confirmationText.match(/ORD-\d+-\d+/)?.[0] ?? "";
  const orderId =
    confirmationText.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    )?.[0] ?? "";

  expect(orderCode).toBeTruthy();
  expect(orderId).toBeTruthy();

  await customerPage.goto("/orders/track");
  await customerPage.getByTestId("track-order-code").fill(orderCode);
  await customerPage.getByTestId("track-order-phone").fill(phone);
  await customerPage.getByTestId("track-order-submit").click();

  await expect(customerPage).toHaveURL(new RegExp(`/orders/${orderId}\\?phone=`));
  await expect(customerPage.getByTestId("tracked-order-page")).toBeVisible();
  await expect(customerPage.getByTestId("tracked-payment-status")).toHaveText("PENDING");

  await customerPage.getByTestId("payment-proof-input").setInputFiles({
    name: "payment-proof.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await customerPage.getByTestId("payment-proof-submit").click();

  await expect(customerPage.getByText("Payment proof uploaded. Seller can review it now.")).toBeVisible();
  await expect(customerPage.getByTestId("tracked-payment-proof-link")).toBeVisible();
  await expect(customerPage.getByText("UPLOAD_PROOF")).toBeVisible();

  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();

  await sellerPage.goto("/login");
  await expect(sellerPage.getByTestId("login-form")).toBeVisible();
  await sellerPage.getByTestId("login-email").fill(demoSeller.email);
  await sellerPage.getByTestId("login-password").fill(demoSeller.password);
  await sellerPage.getByTestId("login-submit").click();

  await sellerPage.waitForURL("**/seller/dashboard");
  await sellerPage.goto(`/seller/payments/${orderId}`);
  await expect(sellerPage.getByTestId("seller-payment-detail-page")).toBeVisible();
  await expect(sellerPage.getByText(orderCode)).toBeVisible();
  await expect(sellerPage.getByTestId("seller-payment-proof-link")).toBeVisible();
  await expect(sellerPage.getByTestId("seller-payment-status")).toHaveText("PENDING");

  sellerPage.once("dialog", (dialog) => dialog.accept());
  await sellerPage.getByTestId("seller-mark-paid-button").click();

  await expect(sellerPage.getByText("Payment marked as paid.")).toBeVisible();
  await expect(sellerPage.getByTestId("seller-payment-status")).toHaveText("PAID");
  await expect(sellerPage.getByText("MARK_PAID")).toBeVisible();

  await customerPage.reload();
  await expect(customerPage.getByTestId("tracked-order-page")).toBeVisible();
  await expect(customerPage.getByTestId("tracked-payment-status")).toHaveText("PAID");

  await sellerContext.close();
  await customerContext.close();
});
