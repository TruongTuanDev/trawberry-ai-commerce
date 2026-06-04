import { expect, test, type Page, type Route } from "@playwright/test";

async function chooseCustomerLocale(page: Page, locale: "en" | "ru") {
  await page.getByTestId("language-switcher-customer").first().click();
  await page.getByTestId(`language-option-customer-${locale}`).first().click();
}

function assertSafeApiUrl(route: Route) {
  const url = route.request().url();
  expect(url).not.toContain("/api/api");
  expect(url).not.toContain("103.245.237.160:3000");
  expect(url).not.toContain("localhost");
}

async function stubCustomerSession(page: Page) {
  await page.route("**/api/auth/customer/me", async (route) => {
    assertSafeApiUrl(route);
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Unauthorized" }),
    });
  });

  await page.route("**/api/auth/customer/refresh", async (route) => {
    assertSafeApiUrl(route);
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "REFRESH_TOKEN_INVALID" }),
    });
  });
}

test("customer register maps duplicate and network errors in English without raw technical text", async ({
  page,
}) => {
  await stubCustomerSession(page);
  await page.route("**/api/auth/customer/register", async (route) => {
    assertSafeApiUrl(route);
    const payload = route.request().postDataJSON() as {
      email?: string;
    };

    if (payload.email === "duplicate@example.com") {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ message: "EMAIL_ALREADY_EXISTS" }),
      });
      return;
    }

    await route.abort("failed");
  });

  await page.goto("/customer/register");
  await page.waitForLoadState("networkidle");
  await chooseCustomerLocale(page, "en");

  await page.getByTestId("customer-register-submit").click();
  await expect(page.getByTestId("customer-register-error")).toContainText("Please enter your email or phone number.");

  await page.getByTestId("customer-register-email").fill("duplicate@example.com");
  await page.getByTestId("customer-register-password").fill("123");
  await page.getByTestId("customer-register-confirm-password").fill("123");
  await page.getByTestId("customer-register-submit").click();
  await expect(page.getByTestId("customer-register-error")).toContainText("Password must be at least 6 characters.");

  await page.getByTestId("customer-register-password").fill("password123");
  await page.getByTestId("customer-register-confirm-password").fill("password124");
  await page.getByTestId("customer-register-submit").click();
  await expect(page.getByTestId("customer-register-error")).toContainText("Password confirmation does not match.");

  await page.getByTestId("customer-register-confirm-password").fill("password123");
  await page.getByTestId("customer-register-submit").click();
  await expect(page.getByTestId("customer-register-error")).toContainText("This email is already registered.");
  await expect(page.getByTestId("customer-register-error")).not.toContainText("EMAIL_ALREADY_EXISTS");
  await expect(page.locator("body")).not.toContainText("Vui lòng");

  await page.getByTestId("customer-register-email").fill("network@example.com");
  await page.getByTestId("customer-register-submit").click();
  await expect(page.getByTestId("customer-register-error")).toContainText("Please check your connection and try again.");
  await expect(page.getByTestId("customer-register-error")).not.toContainText("Failed to fetch");
  await expect(page.getByTestId("customer-register-error")).not.toContainText("Cannot POST");
});

test("customer login maps invalid credentials and network errors in Russian without raw backend text", async ({
  page,
}) => {
  await stubCustomerSession(page);
  await page.route("**/api/auth/customer/login", async (route) => {
    assertSafeApiUrl(route);
    const payload = route.request().postDataJSON() as {
      identifier?: string;
    };

    if (payload.identifier === "network@example.com") {
      await route.abort("failed");
      return;
    }

    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Invalid credentials." }),
    });
  });

  await page.goto("/customer/login");
  await page.waitForLoadState("networkidle");
  await chooseCustomerLocale(page, "ru");

  await page.getByTestId("customer-login-submit").click();
  await expect(page.getByTestId("customer-login-error")).toContainText("Укажите email или телефон.");

  await page.getByTestId("customer-login-email").fill("user@example.com");
  await page.getByTestId("customer-login-password").fill("123");
  await page.getByTestId("customer-login-submit").click();
  await expect(page.getByTestId("customer-login-error")).toContainText("Пароль должен содержать минимум 6 символов.");

  await page.getByTestId("customer-login-password").fill("password123");
  await page.getByTestId("customer-login-submit").click();
  await expect(page.getByTestId("customer-login-error")).toContainText("Неверный email или пароль.");
  await expect(page.getByTestId("customer-login-error")).not.toContainText("Invalid credentials");
  await expect(page.getByTestId("customer-login-error")).not.toContainText("Unauthorized");

  await page.getByTestId("customer-login-email").fill("network@example.com");
  await page.getByTestId("customer-login-submit").click();
  await expect(page.getByTestId("customer-login-error")).toContainText(
    "Проверьте подключение к интернету и попробуйте снова.",
  );
  await expect(page.locator("body")).not.toContainText("Failed to fetch");
  await expect(page.locator("body")).not.toContainText("Cannot POST");
  await expect(page.locator("body")).not.toContainText("/api/api");
  await expect(page.locator("body")).not.toContainText("Đăng nhập");
});

test("expired customer session redirects to login with localized session message and no raw Unauthorized text", async ({
  page,
}) => {
  await stubCustomerSession(page);

  await page.goto("/customer/orders");
  await page.waitForURL(/\/customer\/login\?next=/);

  await expect(page.getByTestId("toast-error")).toContainText(
    "Сессия истекла. Войдите снова.",
  );
  await expect(page.locator("body")).not.toContainText("Unauthorized");
  await expect(page.locator("body")).not.toContainText("Failed to fetch");
});
