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

async function expectPersistedRoleLocale(
  page: Page,
  role: LocaleRole,
  locale: Locale,
) {
  await expect
    .poll(async () =>
      page.evaluate(
        ([nextRole, nextLocale, storageKey, cookieKey]) => ({
          root: window.localStorage.getItem(storageKey),
          role: window.localStorage.getItem(`${storageKey}:${nextRole}`),
          cookie: document.cookie.includes(`${cookieKey}=${nextLocale}`),
        }),
        [role, locale, LOCALE_STORAGE_KEY, LOCALE_COOKIE_KEY] as const,
      ),
    )
    .toMatchObject({
      root: locale,
      role: locale,
      cookie: true,
    });
}

test("role-based locale defaults and switching persist by surface", async ({
  browser,
}) => {
  const publicPage = await newCleanPage(browser);
  const publicNav = publicPage.getByRole("navigation", {
    name: "Public navigation",
  }).first();
  const publicSwitcher = publicPage
    .locator('[data-testid="language-switcher-customer"]:visible')
    .first();

  await publicPage.goto("/products");
  await expect(publicSwitcher).toContainText("RU");
  await persistRoleLocale(publicPage, "customer", "en");
  await publicPage.reload();
  await expectPersistedRoleLocale(publicPage, "customer", "en");
  await expect(publicNav).toContainText("Shop");
  await publicPage.reload();
  await expect(publicNav).toContainText("Shop");
  await persistRoleLocale(publicPage, "customer", "vi");
  await publicPage.reload();
  await expectPersistedRoleLocale(publicPage, "customer", "vi");
  await expect(publicNav).toContainText("Mua sắm");
  await publicPage.context().close();

  const sellerPage = await newCleanPage(browser);
  const sellerForm = sellerPage.getByTestId("seller-login-form");

  await sellerPage.goto("/seller/login");
  await expect(sellerForm).toBeVisible();
  await expect(sellerPage.getByTestId("seller-login-email")).toBeVisible();
  await expect(sellerPage.getByTestId("seller-login-password")).toBeVisible();
  await expect(sellerPage.getByTestId("seller-login-submit")).toBeVisible();

  await persistRoleLocale(sellerPage, "seller", "vi");
  await sellerPage.reload();
  await expectPersistedRoleLocale(sellerPage, "seller", "vi");

  await persistRoleLocale(sellerPage, "seller", "en");
  await sellerPage.reload();
  await expectPersistedRoleLocale(sellerPage, "seller", "en");
  await expect(sellerForm).toContainText("Sign in to seller workspace");
  await expect(sellerForm).toContainText("Email or phone");
  await sellerPage.context().close();

  const adminPage = await newCleanPage(browser);
  await adminPage.goto("/admin-login");
  await persistRoleLocale(adminPage, "admin", "ru");
  await adminPage.reload();
  await expect(
    adminPage.getByRole("heading", { name: "Вход администратора" }),
  ).toBeVisible();
  await expect(
    adminPage.getByText("Войдите в кабинет операций маркетплейса."),
  ).toBeVisible();
  await expect(adminPage.getByTestId("language-switcher-admin")).toHaveCount(0);
  await adminPage.context().close();
});
