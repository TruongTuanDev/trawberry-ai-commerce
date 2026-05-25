import { expect, test, type Page } from "@playwright/test";

async function chooseCustomerLocale(page: Page, locale: "ru" | "en") {
  await page.getByTestId("language-switcher-customer").click();
  await page.getByTestId(`language-option-customer-${locale}`).click();
}

test("customer account i18n: auth pages, notifications, returns, and locale persistence", async ({
  page,
}) => {
  test.setTimeout(180000);

  const stamp = Date.now();
  const email = `i18n-customer-${stamp}@example.com`;
  const password = "password123";

  await page.goto("/customer/login");
  await expect(
    page.getByRole("heading", { name: /Вход покупателя|Customer login/ }),
  ).toBeVisible();
  await page.getByTestId("language-switcher-customer").click();
  await expect(page.getByTestId("language-option-customer-vi")).toHaveCount(0);
  await page.getByTestId("language-option-customer-en").click();
  await expect(
    page.getByRole("heading", { name: "Customer login", exact: true }),
  ).toBeVisible();

  await page.goto("/customer/register");
  await expect(
    page.getByRole("heading", { name: "Create customer account", exact: true }),
  ).toBeVisible();
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

  await chooseCustomerLocale(page, "ru");
  await expect(
    page.getByRole("heading", { name: "Мои заказы", exact: true }),
  ).toBeVisible({ timeout: 15000 });

  await page.goto("/customer/notifications");
  await expect(
    page.getByRole("heading", { name: "Уведомления", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Мои уведомления", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Thông báo")).toHaveCount(0);
  await expect(page.getByText("Xem và quản lý")).toHaveCount(0);

  await page.goto("/customer/returns");
  await expect(
    page.getByRole("heading", { name: "Возвраты и возврат денег", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Returns and refunds")).toHaveCount(0);
  await expect(page.getByText("Back to orders")).toHaveCount(0);
  await expect(page.getByText("Open case")).toHaveCount(0);
  await expect(page.getByText("Chọn tệp")).toHaveCount(0);
  await expect(
    page.locator('label[for="customer-return-evidence-file"]'),
  ).toHaveText("Выбрать файл");
  await expect(
    page.getByTestId("customer-return-evidence-file-name"),
  ).toContainText("Файл не выбран");

  await chooseCustomerLocale(page, "en");
  await expect(
    page.getByRole("heading", { name: "Returns and refunds", exact: true }),
  ).toBeVisible({ timeout: 15000 });

  await page.goto("/customer/notifications");
  await expect(
    page.getByRole("heading", { name: "Notifications", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "My notifications", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Thông báo")).toHaveCount(0);

  await page.goto("/customer/returns");
  await expect(
    page.getByRole("heading", { name: "Returns and refunds", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Back to my orders")).toBeVisible();
  await expect(page.getByTestId("customer-return-submit")).toContainText(
    "Open case",
  );
  await expect(
    page.locator('label[for="customer-return-evidence-file"]'),
  ).toHaveText("Choose file");
  await expect(
    page.getByTestId("customer-return-evidence-file-name"),
  ).toContainText("No file selected");

  await page.goto("/customer/account/profile");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Profile", exact: true }),
  ).toBeVisible({ timeout: 15000 });

  await page.getByTestId("language-switcher-customer").click();
  await expect(page.getByTestId("language-option-customer-vi")).toHaveCount(0);
  await page.getByTestId("language-option-customer-ru").click();
  await page.goto("/customer/orders");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Мои заказы", exact: true }),
  ).toBeVisible({ timeout: 15000 });
});
