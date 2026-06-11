import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, role: "admin" | "seller") {
  const credentials =
    role === "admin"
      ? {
          route: "/admin-login",
          email: "demo-admin@trawberry.local",
          password: "DemoAdmin123!",
          destination: "**/admin/dashboard",
        }
      : {
          route: "/seller-login",
          email: "demo-seller@trawberry.local",
          password: "DemoSeller123!",
          destination: "**/seller/dashboard",
        };

  await page.goto(credentials.route);
  await page.getByTestId(`${role}-login-email`).fill(credentials.email);
  await page.getByTestId(`${role}-login-password`).fill(credentials.password);
  await page.getByTestId(`${role}-login-submit`).click();
  await page.waitForURL(credentials.destination);
}

async function expectInsideViewport(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual((await page.viewportSize())!.width);
}

async function expectAllInsideViewport(page: Page, selector: string) {
  for (const element of await page.locator(selector).all()) {
    const box = await element.boundingBox();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual((await page.viewportSize())!.width);
  }
}

test("mobile admin controls and recommendation cards remain reachable", async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "admin");

  await expectInsideViewport(page, '[data-testid="admin-header-controls"]');
  await page.goto("/admin/recommendations-analytics");
  await expect(page.getByTestId("admin-recommendations-analytics-page")).toBeVisible();

  await expectAllInsideViewport(page, "main section");
});

test("seller toolbar and dense operational cards stay inside tablet and mobile viewports", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 768, height: 1024 });
  await login(page, "seller");
  await expectInsideViewport(page, '[data-testid="seller-header-controls"]');
  await expect(page.getByTestId("seller-navigation-desktop")).not.toBeVisible();
  await page.getByTestId("seller-mobile-menu-toggle").click();
  await expect(page.getByTestId("seller-navigation-mobile")).toBeVisible();
  await expect(page.getByTestId("seller-navigation-mobile").locator("nav section").first()).toBeVisible();
  await expect(page.getByTestId("seller-mobile-menu").locator("input")).toHaveCount(0);
  await page.getByTestId("seller-mobile-menu-close").click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/seller/recommendations-analytics");
  await expectAllInsideViewport(page, '[data-testid="seller-shop-switcher"] *');
  await expectAllInsideViewport(page, "main section");

  await page.goto("/seller/import/wildberries-api");
  await expect(page.getByTestId("wb-api-sync-page")).toBeVisible();
  for (const testId of [
    "wb-api-publish-mode",
    "wb-api-preview-all",
    "wb-api-import-all",
    "wb-api-codes",
    "wb-api-preview-selected",
    "wb-api-import-selected",
    "wb-api-key",
    "wb-api-save-credentials",
  ]) {
    await expectInsideViewport(page, `[data-testid="${testId}"]`);
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/seller/dashboard");
  await expect(page.getByTestId("seller-navigation-desktop")).toBeVisible();
  await expect(page.getByTestId("seller-navigation-desktop").locator("nav section").first()).toBeVisible();
  await expect(page.getByTestId("seller-navigation-desktop").locator("input")).toHaveCount(0);
});
