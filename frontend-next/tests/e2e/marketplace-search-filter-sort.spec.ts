import { expect, test } from "@playwright/test";

test("public marketplace search, filters, sort, and detail expose category fields", async ({ page }) => {
  await page.goto("/products");
  await expect(page.getByTestId("products-grid")).toBeVisible();

  await page.getByTestId("marketplace-search").fill("Linen Bloom");
  await page.getByTestId("marketplace-apply").click();
  await expect(page).toHaveURL(/q=Linen\+Bloom|q=Linen%20Bloom/);
  await expect(page.locator("[data-testid='product-card']").first()).toContainText("Linen Bloom Dress");
  await expect(page.locator("[data-testid='product-card']").first()).toContainText("Berry Atelier");

  await page.getByTestId("marketplace-category").selectOption("dresses");
  await page.getByTestId("marketplace-stock").selectOption("true");
  await page.getByTestId("marketplace-apply").click();
  await expect(page).toHaveURL(/categorySlug=dresses/);
  await expect(page.locator("[data-testid='product-card']").first()).toContainText("Платья");

  await page.getByTestId("marketplace-clear").click();
  await page.getByTestId("marketplace-sort").selectOption("price_asc");
  await page.getByTestId("marketplace-apply").click();
  await expect(page).toHaveURL(/sort=price_asc/);
  await expect(page.locator("[data-testid='product-card']").first()).toBeVisible();

  await page.getByTestId("marketplace-sort").selectOption("price_desc");
  await page.getByTestId("marketplace-apply").click();
  await expect(page).toHaveURL(/sort=price_desc/);

  await page.getByTestId("marketplace-search").fill("Linen Bloom");
  await page.getByTestId("marketplace-apply").click();
  await page.locator("[data-testid^='product-view-']").first().click();
  await expect(page).toHaveURL(/\/products\/[^/]+$/);
  await expect(page.getByText("Berry Atelier")).toBeVisible();
  await expect(page.getByText("Платья")).toBeVisible();
});
