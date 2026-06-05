import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  LOCALE_COOKIE_KEY,
  LOCALE_STORAGE_KEY,
  type Locale,
  type LocaleRole,
} from "../../src/i18n/config";

const frontendBaseUrl =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

async function newCleanPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    baseURL: frontendBaseUrl,
  });
  await context.clearCookies();
  return context.newPage();
}

async function expectVisibleFlags(
  page: Page,
  role: "customer",
  locales: Array<"ru" | "en" | "vi">,
  missing: Array<"ru" | "en" | "vi"> = [],
) {
  await page.locator(`[data-testid="language-switcher-${role}"]:visible`).first().click();
  await expect(page.getByTestId("language-switcher-dropdown")).toBeVisible();
  for (const locale of locales) {
    await expect(page.getByTestId(`locale-flag-${locale}`)).toBeVisible();
  }
  for (const locale of missing) {
    await expect(page.getByTestId(`locale-flag-${locale}`)).toHaveCount(0);
  }
  await page.keyboard.press("Escape");
}

async function chooseLocale(
  page: Page,
  role: "customer",
  locale: "ru" | "en",
) {
  await page.locator(`[data-testid="language-switcher-${role}"]:visible`).first().click();
  await expect(page.getByTestId("language-switcher-dropdown")).toBeVisible();
  await page.getByTestId(`language-option-${role}-${locale}`).click();
}

async function persistRoleLocale(
  page: Page,
  role: LocaleRole,
  locale: Locale,
) {
  await page.context().addCookies([
    {
      name: LOCALE_COOKIE_KEY,
      value: locale,
      url: frontendBaseUrl,
    },
  ]);
  await page.evaluate(
    ([nextRole, nextLocale, storageKey, cookieKey]) => {
      window.localStorage.setItem(storageKey, nextLocale);
      window.localStorage.setItem(`${storageKey}:${nextRole}`, nextLocale);
      document.cookie = `${cookieKey}=${nextLocale}; path=/; samesite=lax`;
    },
    [role, locale, LOCALE_STORAGE_KEY, LOCALE_COOKIE_KEY] as const,
  );
}

test("role-based locale defaults and switching persist by surface", async ({
  browser,
}) => {
  const publicPage = await newCleanPage(browser);
  const publicNav = publicPage.getByRole("navigation", {
    name: "Public navigation",
  }).first();

  await publicPage.goto("/products");
  await expectVisibleFlags(publicPage, "customer", ["ru", "en"], ["vi"]);
  await expect(publicNav).toContainText("Каталог");
  await chooseLocale(publicPage, "customer", "en");
  await expect(publicNav).toContainText("Shop");
  await publicPage.reload();
  await expect(publicNav).toContainText("Shop");
  await publicPage.context().close();

  const sellerPage = await newCleanPage(browser);
  const sellerForm = sellerPage.getByTestId("seller-login-form");

  await sellerPage.goto("/seller/login");
  await expect(sellerForm).toContainText("Войти в личный кабинет продавца");
  await expect(sellerForm).toContainText("Email или телефон");

  await persistRoleLocale(sellerPage, "seller", "vi");
  await sellerPage.reload();
  await expect(sellerForm).toContainText("Đăng nhập vào không gian seller");
  await expect(sellerForm).toContainText("Email hoặc số điện thoại");

  await persistRoleLocale(sellerPage, "seller", "en");
  await sellerPage.reload();
  await expect(sellerForm).toContainText("Sign in to seller workspace");
  await expect(sellerForm).toContainText("Email or phone");
  await sellerPage.context().close();

  const adminPage = await newCleanPage(browser);
  await adminPage.goto("/admin-login");
  await persistRoleLocale(adminPage, "admin", "ru");
  await adminPage.reload();
  await expect(adminPage.getByText("Admin login")).toBeVisible();
  await expect(adminPage.getByText("Log in to marketplace operations.")).toBeVisible();
  await expect(adminPage.getByTestId("language-switcher-admin")).toHaveCount(0);
  await adminPage.context().close();
});
