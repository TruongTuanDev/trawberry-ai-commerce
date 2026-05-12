import { expect, test } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

test("cookie auth flow survives refresh and blocks protected routes after logout", async ({ page, request }) => {
  const email = `seller-cookie-${Date.now()}@example.com`;
  const password = "password123";

  const registerResponse = await request.post(`${backendBaseUrl}/api/auth/register`, {
    data: {
      email,
      password,
      fullName: "Cookie Seller",
      role: "SELLER",
    },
  });

  expect(registerResponse.status()).toBe(201);

  await page.goto("/login");
  await expect(page.getByTestId("login-form")).toBeVisible();

  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();

  await page.waitForURL("**/seller/dashboard");
  await expect(page.getByTestId("seller-shell")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Seller Center", exact: true })).toBeVisible();

  const localStorageSnapshot = await page.evaluate(() => {
    const values: Record<string, string> = {};
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) {
        continue;
      }

      values[key] = window.localStorage.getItem(key) ?? "";
    }

    return values;
  });

  const jwtLikePattern = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
  const localStorageValues = Object.values(localStorageSnapshot);

  expect(Object.keys(localStorageSnapshot)).not.toContain("accessToken");
  expect(Object.keys(localStorageSnapshot)).not.toContain("refreshToken");
  expect(localStorageValues.some((value) => jwtLikePattern.test(value))).toBeFalsy();

  await page.reload();
  await page.waitForURL("**/seller/dashboard");
  await expect(page.getByTestId("seller-shell")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();

  await page.getByTestId("logout-button").click();
  await page.waitForURL(/\/login(\?|$)/);
  await expect(page.getByTestId("login-form")).toBeVisible();

  await page.goto("/seller/dashboard");
  await page.waitForURL(/\/login(\?|$)/);
  await expect(page.getByTestId("login-form")).toBeVisible();
});
