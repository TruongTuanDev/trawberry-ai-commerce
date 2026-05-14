import path from "node:path";
import { expect, test } from "@playwright/test";

test("seller previews and confirms Wildberries Excel import", async ({ page }) => {
  test.setTimeout(90000);

  const fixturePath = path.resolve("../backend-nest/test/fixtures/wb-products-sample.xlsx");

  await page.goto("/login");
  await page.getByTestId("login-email").fill("demo-seller@trawberry.local");
  await page.getByTestId("login-password").fill("DemoSeller123!");
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/seller/dashboard");

  await page.goto("/seller/import/wildberries");
  await expect(page.getByTestId("wb-import-page")).toBeVisible();
  await page.getByTestId("wb-import-file").setInputFiles(fixturePath);
  await page.getByTestId("wb-import-default-stock").fill("6");
  await page.getByTestId("wb-import-publish-mode").selectOption("ACTIVE");
  await page.getByTestId("wb-import-preview").click();

  await expect(page.getByTestId("wb-import-summary")).toContainText("Products");
  await expect(page.getByTestId("wb-import-product-row").filter({ hasText: "SKU-100" })).toBeVisible();
  await expect(page.getByTestId("wb-import-product-row").filter({ hasText: "WB Linen Shorts" })).toBeVisible();

  await page.getByTestId("wb-import-confirm").click();
  await expect(page.getByTestId("wb-import-result")).toBeVisible();

  await page.getByRole("link", { name: "Open products" }).click();
  await page.getByPlaceholder("Search by product name, WB ID, brand or vendor code...").fill("WB Linen Shorts");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByTestId("seller-product-row").filter({ hasText: "WB Linen Shorts" })).toBeVisible();
});
