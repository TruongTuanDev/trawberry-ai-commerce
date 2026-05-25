import { expect, test } from "@playwright/test";

test("customer account i18n: auth pages, account shell, and locale persistence", async ({ page }) => {
  test.setTimeout(180000);

  const stamp = Date.now();
  const email = `i18n-customer-${stamp}@example.com`;
  const password = "password123";

  await page.goto("/customer/login");
  await expect(page.getByRole("heading", { name: /Вход покупателя|Customer login/ })).toBeVisible();
  await page.getByTestId("language-switcher-customer").click();
  await expect(page.getByTestId("language-option-customer-vi")).toHaveCount(0);
  await page.getByTestId("language-option-customer-en").click();
  await expect(page.getByRole("heading", { name: "Customer login" })).toBeVisible();

  await page.goto("/customer/register");
  await expect(page.getByRole("heading", { name: "Create customer account" })).toBeVisible();
  await page.getByTestId("customer-register-name").fill("I18n Customer");
  await page.getByTestId("customer-register-email").fill(email);
  await page.getByTestId("customer-register-password").fill(password);
  await page.getByTestId("customer-register-confirm-password").fill(password);
  await page.getByTestId("customer-register-submit").click();
  await page.waitForURL("**/customer/login?registered=1");

  await page.getByTestId("customer-login-email").fill(email);
  await page.getByTestId("customer-login-password").fill(password);
  await page.getByTestId("customer-login-submit").click();
  await page.waitForURL("**/customer/orders");

  await page.goto("/customer/account/profile");
  await page.getByTestId("language-switcher-customer").click();
  await page.getByTestId("language-option-customer-ru").click();
  await expect(page.getByRole("heading", { name: "Профиль" })).toBeVisible();
  await expect(page.getByText("Полное имя").first()).toBeVisible();

  await page.goto("/customer/account/addresses");
  await expect(page.getByRole("heading", { name: "Адреса доставки" })).toBeVisible();
  await expect(page.getByText("Полное имя получателя").first()).toBeVisible();

  await page.goto("/customer/account/security");
  await expect(page.getByRole("heading", { name: "Безопасность" })).toBeVisible();
  await expect(page.getByText("Текущий пароль").first()).toBeVisible();

  await page.goto("/customer/orders");
  await expect(page.getByRole("heading", { name: "Мои заказы" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Мои заказы" })).toBeVisible();

  await page.getByTestId("language-switcher-customer").click();
  await page.getByTestId("language-option-customer-en").click();
  await expect(page.getByRole("heading", { name: "My orders" })).toBeVisible();
});
