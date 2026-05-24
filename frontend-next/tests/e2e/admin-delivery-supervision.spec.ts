import { expect, test } from "@playwright/test";

test("admin delivery supervision stays read-only in the UI", async ({ page }) => {
  await page.goto("/admin-login");
  await page.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
  await page.getByTestId("admin-login-password").fill("DemoAdmin123!");
  await page.getByTestId("admin-login-submit").click();
  await page.waitForURL("**/admin/dashboard");

  await page.goto("/admin/deliveries");
  await expect(page.getByTestId("admin-deliveries-page")).toBeVisible();
  await expect(page.getByTestId("admin-supervision-readonly-note")).toContainText("Seller owns fulfillment status transitions");
  await expect(page.getByRole("button", { name: /mark in delivery|mark completed|mark cancelled|archive/i })).toHaveCount(0);
});
