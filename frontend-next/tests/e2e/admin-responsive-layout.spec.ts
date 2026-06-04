import { expect, test } from "@playwright/test";

const viewports = [
  { width: 1440, height: 900, name: "desktop-wide" },
  { width: 1366, height: 768, name: "laptop" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 390, height: 844, name: "mobile" },
];

const keyRoutes = [
  "/admin/dashboard",
  "/admin/sellers",
  "/admin/deliveries",
  "/admin/payments-supervision",
  "/admin/returns",
  "/admin/messages",
  "/admin/reviews",
  "/admin/notifications",
];

async function loginAdmin(page) {
  await page.goto("/admin-login");
  await page.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
  await page.getByTestId("admin-login-password").fill("DemoAdmin123!");
  await page.getByTestId("admin-login-submit").click();
  await page.waitForURL("**/admin/dashboard");
}

test.describe("Admin Responsive Layout & Overflow Audit", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120000);
    await loginAdmin(page);
  });

  for (const vp of viewports) {
    test(`verify layout integrity and no overflow on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const route of keyRoutes) {
        await page.goto(route);
        await expect(page.getByTestId("admin-shell")).toBeVisible();

        // Let the page render and execute any layout scripts/effects
        await page.waitForTimeout(500);

        // Verify that there is no document-level horizontal overflow
        const hasOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
        });
        expect(hasOverflow).toBeFalsy();

        // Verify sidebar visibility based on viewport size
        if (vp.width >= 1024) {
          // Sidebar should be visible on desktop/laptop
          await expect(page.locator("aside.hidden.lg\\:block")).toBeVisible();
          await expect(page.getByTestId("admin-mobile-menu-toggle")).not.toBeVisible();
        } else {
          // Sidebar should be hidden, and hamburger menu toggle should be visible
          await expect(page.locator("aside.hidden.lg\\:block")).not.toBeVisible();
          const hamburger = page.getByTestId("admin-mobile-menu-toggle");
          await expect(hamburger).toBeVisible();

          // Verify mobile menu opens and closes correctly on the first route (dashboard)
          if (route === "/admin/dashboard") {
            await hamburger.click();
            const mobileMenu = page.getByTestId("admin-mobile-menu");
            await expect(mobileMenu).toBeVisible();

            // Click the close button
            await page.getByTestId("admin-mobile-menu-close").click();
            await expect(mobileMenu).not.toBeVisible();
          }
        }
      }
    });
  }
});
