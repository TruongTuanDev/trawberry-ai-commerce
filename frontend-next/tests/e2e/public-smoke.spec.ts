import { expect, test } from "@playwright/test";

test("public marketplace routes load and basic navigation works", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("public-shell")).toBeVisible();
  await expect(page.getByTestId("public-logo")).toBeVisible();

  await page.getByTestId("public-nav").getByRole("link", { name: "Shop", exact: true }).click();
  await page.waitForURL("**/products");
  await expect(page.getByTestId("products-grid")).toBeVisible();

  const productCards = page.getByTestId("product-card");
  const productCount = await productCards.count();
  if (productCount > 0) {
    await productCards.first().getByRole("link", { name: "View" }).click();
    await expect(page).toHaveURL(/\/products\/.+/);
  }

  await page.goto("/orders/track");
  await expect(page.getByTestId("track-order-submit")).toBeVisible();
});
