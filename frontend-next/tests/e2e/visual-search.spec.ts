import { expect, test } from "@playwright/test";

const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=";

async function setVisualSearchFlags(
  page: Parameters<typeof test>[0]["page"],
  enabled: boolean,
  tracking = false,
) {
  await page.goto("/");
  await page.evaluate(
    ({ nextEnabled, nextTracking }) => {
      window.localStorage.setItem(
        "trawberry_visual_search_enabled",
        String(nextEnabled),
      );
      window.localStorage.setItem(
        "trawberry_visual_search_tracking_enabled",
        String(nextTracking),
      );
    },
    { nextEnabled: enabled, nextTracking: tracking },
  );
  await page.reload();
}

test.describe("public visual search", () => {
  test("camera icon stays hidden when the feature flag is off", async ({ page }) => {
    await setVisualSearchFlags(page, false);

    await expect(page.getByTestId("public-header-visual-search-trigger")).toHaveCount(0);
  });

  test("modal opens on flag on and upload preview appears", async ({ page }) => {
    await setVisualSearchFlags(page, true);

    await page.getByTestId("public-header-visual-search-trigger").click();
    await expect(page.getByTestId("visual-search-modal")).toBeVisible();

    await page.getByTestId("visual-search-file-input").setInputFiles({
      name: "visual-search.png",
      mimeType: "image/png",
      buffer: Buffer.from(tinyPngBase64, "base64"),
    });

    await expect(page.getByTestId("visual-search-preview-image")).toBeVisible();
  });

  test("api error shows a friendly message and empty results stay safe", async ({ page }) => {
    await setVisualSearchFlags(page, true);
    await page.route("**/api/public/visual-search", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "boom" }),
      });
    });

    await page.getByTestId("public-header-visual-search-trigger").click();
    await page.getByTestId("visual-search-file-input").setInputFiles({
      name: "visual-search.png",
      mimeType: "image/png",
      buffer: Buffer.from(tinyPngBase64, "base64"),
    });
    await page.getByTestId("visual-search-submit").click();

    await expect(page.getByTestId("visual-search-error")).toBeVisible();

    await page.unroute("**/api/public/visual-search");
    await page.route("**/api/public/visual-search", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          analysis: {
            category: "Шорты",
            color: null,
            gender: null,
            keywords: [],
          },
          products: [],
          algorithm: "visual_search_rule_based_v1",
          visualSearchLogId: "log-1",
        }),
      });
    });

    await page.getByTestId("visual-search-submit").click();
    await expect(page.getByTestId("visual-search-empty-state")).toBeVisible();
    await expect(page.getByTestId("visual-search-product-grid")).toHaveCount(0);
  });

  test("normal text search still works with visual search present", async ({ page }) => {
    await setVisualSearchFlags(page, true);

    await page.getByTestId("public-header-search").fill("Linen Bloom");
    await page.getByTestId("public-header-search").press("Enter");

    await expect(page).toHaveURL(/\/products\?q=Linen(\+|%20)Bloom/);
  });
});
