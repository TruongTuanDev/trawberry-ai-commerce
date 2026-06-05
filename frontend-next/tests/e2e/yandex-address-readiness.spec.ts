import { expect, test } from "@playwright/test";
import { LOCALE_COOKIE_KEY, LOCALE_STORAGE_KEY } from "../../src/i18n/config";

test("customer can promote address from manual-ready to api-ready with manual coordinates", async ({ page }) => {
  test.setTimeout(180000);
  const stamp = Date.now();
  const email = `yandex-readiness-customer-${stamp}@example.com`;
  const password = "password123";

  await page.goto("/customer/register");
  await page.getByTestId("customer-register-name").fill("Address Readiness Customer");
  await page.getByTestId("customer-register-email").fill(email);
  await page.getByTestId("customer-register-password").fill(password);
  await page.getByTestId("customer-register-confirm-password").fill(password);
  await page.getByTestId("customer-register-submit").click();
  await page.waitForURL("**/customer/login?registered=1");
  await page.getByTestId("customer-login-email").fill(email);
  await page.getByTestId("customer-login-password").fill(password);
  await page.getByTestId("customer-login-submit").click();
  await page.waitForURL("**/customer/orders");
  await page.context().addCookies([
    {
      name: LOCALE_COOKIE_KEY,
      value: "en",
      url: "http://127.0.0.1:3000",
    },
  ]);
  await page.evaluate(
    ([storageKey, cookieKey]) => {
      window.localStorage.setItem(storageKey, "en");
      window.localStorage.setItem(`${storageKey}:customer`, "en");
      document.cookie = `${cookieKey}=en; path=/; samesite=lax`;
    },
    [LOCALE_STORAGE_KEY, LOCALE_COOKIE_KEY] as const,
  );

  await page.goto("/customer/account/addresses");
  await page.getByTestId("customer-address-fullName").fill("Address Readiness Customer");
  await page.getByTestId("customer-address-phone").fill("+79991234567");
  await page.getByTestId("customer-address-city").fill("Moscow");
  await page.getByTestId("customer-address-street").fill("Tverskaya");
  await page.getByTestId("customer-address-building").fill("18");
  await page.getByTestId("customer-address-no-entrance").check();
  await page.getByTestId("customer-address-no-floor").check();
  await page.getByTestId("customer-address-no-apartment").check();
  await page.getByTestId("customer-address-save").click();
  await expect(page.getByTestId("customer-address-card")).toContainText("Manual-ready");

  await page.locator('[data-testid^="customer-address-edit-"]').first().click();
  await page.getByRole("button", { name: "Use manual coordinates" }).click();
  await page.getByTestId("customer-address-latitude").fill("55.765369");
  await page.getByTestId("customer-address-longitude").fill("37.605192");
  await page.getByRole("button", { name: "Mark as manual pin" }).click();
  await page.getByTestId("customer-address-save").click();
  await expect(page.getByTestId("customer-address-card")).toContainText("Yandex-ready");
});
