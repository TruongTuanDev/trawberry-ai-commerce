import { expect, test } from "@playwright/test";

test("public marketplace routes load and basic navigation works", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("public-shell")).toBeVisible();
  await expect(page.getByTestId("public-logo")).toBeVisible();

  await page.goto("/products");
  await expect(page.getByTestId("products-grid")).toBeVisible();

  const productCards = page.getByTestId("product-card");
  const productCount = await productCards.count();
  if (productCount > 0) {
    await productCards.first().getByRole("link", { name: "View" }).click();
    await expect(page).toHaveURL(/\/products\/.+/);
    await expect(page.getByTestId("product-detail-title")).toBeVisible();

    await page.getByTestId("product-open-details").click();
    await expect(page.getByTestId("product-details-drawer")).toBeVisible();
    await expect(page.getByTestId("product-close-details")).toBeVisible();
    await page.getByTestId("product-close-details").click();
    await expect(page.getByTestId("product-details-drawer")).toBeHidden();

    await page.goBack();
    await expect(page).toHaveURL(/\/products(?:\?.*)?$/);
    await expect(page.getByTestId("products-grid")).toBeVisible();
  }

  await page.goto("/orders/track");
  await expect(page.getByTestId("track-order-submit")).toBeVisible();
});
