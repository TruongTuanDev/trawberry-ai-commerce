import { expect, test } from "@playwright/test";

test("seeded public customer flow completes checkout, tracking, and proof upload", async ({ page }) => {
  test.setTimeout(60000);

  await page.goto("/");
  await page.getByTestId("public-nav").getByRole("link", { name: "Shop", exact: true }).click();
  await page.waitForURL("**/products");
  await page.getByTestId("marketplace-search").fill("Linen Bloom Dress");
  await page.getByTestId("marketplace-apply").click();

  const seededCard = page.getByTestId("product-card").filter({ hasText: "Linen Bloom Dress" });
  await expect(seededCard).toHaveCount(1);
  await seededCard.getByRole("link", { name: "View" }).click();

  await expect(page).toHaveURL(/\/products\/.+/);
  await expect(page.getByRole("heading", { name: "Linen Bloom Dress" })).toBeVisible();
  await page.getByTestId("continue-to-checkout").click();

  await page.waitForURL(/\/checkout/);
  await page.getByTestId("checkout-full-name").fill("Demo Customer");
  await page.getByTestId("checkout-phone").fill("+79990000001");
  await page.getByTestId("checkout-email").fill("demo-customer@example.com");
  await page.getByTestId("checkout-address").fill("Demo Address");
  await page.getByTestId("checkout-note").fill("Please confirm transfer receipt.");
  await page.getByTestId("checkout-submit").click();

  await expect(page.getByTestId("checkout-confirmation")).toBeVisible();
  const confirmationText = await page.getByTestId("checkout-confirmation").innerText();
  const orderCodeMatch = confirmationText.match(/ORD-\d+-\d+/);
  const orderIdMatch = confirmationText.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  );

  expect(orderCodeMatch?.[0]).toBeTruthy();
  expect(orderIdMatch?.[0]).toBeTruthy();

  await page.getByTestId("confirmation-track-link").click();
  await expect(page).toHaveURL(/\/orders\/.+\?phone=/);
  await expect(page.getByTestId("tracked-order-page")).toBeVisible();
  await expect(page.getByText(orderCodeMatch?.[0] ?? "")).toBeVisible();
  await expect(page.getByText("PENDING")).toHaveCount(2);

  await page.getByTestId("payment-proof-input").setInputFiles({
    name: "payment-proof.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByTestId("payment-proof-submit").click();

  await expect(page.getByText("Payment proof uploaded. Seller can review it now.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open proof" })).toBeVisible();
  await expect(page.getByText("BUYER_MARKED_PAID")).toBeVisible();
});
